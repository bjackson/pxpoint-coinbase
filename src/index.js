const EventEmitter = require("events").EventEmitter;
const WebSocket = require('ws');
const CoinbaseExchange = require('coinbase-exchange');
const async = require('async');

class Coinbase extends EventEmitter {
  constructor(options) {
    super();
    this.products = options.products;
    this.orderBookInitialized = false;
    this.queuedMessages = {};
    this.clients = {};
    this.ws = {};
    this.products.forEach(product => {
      this.queuedMessages[product] = [];
      this.clients[product] = new CoinbaseExchange.PublicClient({ productID: product });
    });
  }

  connect() {
    this.products.forEach(product => {
      this.ws[product] = new WebSocket('wss://ws-feed.exchange.coinbase.com');
      this.registerCallbacks(product);
    });
  }

  registerCallbacks(product) {
    return new Promise((resolve, reject) => {
        this.ws[product].on('message', data => {
          data = JSON.parse(data);
          this.queuedOrders.push({
            eventType: data.type,
            data: transformData(data)
          });
        });

        this.ws[product].on('close', () => {
          this.emit('close');
        });

        this.ws[product].on('open', () => {
          this.ws[product].send(JSON.stringify({
            type: 'subscribe',
            product_id: product
          }), err => {
            if (err) {
              this.emit('error', err);
              reject(err);
            } else {
              resolve();
            }
          });
        });
    });
  }

  createOrderBook() {
    this.products.forEach(product => {
      this.clients[product].getProductOrderBook({ level: 3 }, data => {
        this.queuedMessages[product].forEach(message => {
          this.emit('message', {
            eventType: message.type,
            data: transformData(message)
          });
        });

        this.ws[product].removeAllListeners();

        this.ws[product].on('message', data => {
          data = JSON.parse(data);
          if (data.type != 'received') {
            this.emit('message', {
              eventType: data.type,
              data: transformData(data)
            });
          }
        });

        this.ws[product].on('close', () => {
          this.emit('close');
        });

        this.ws[product].on('open', () => {
            this.ws[product].send(JSON.stringify({
              type: 'subscribe',
              product_id: product
            }), err => {
              if (err) {
                this.emit('error', err);
              }
            });
        });
      });
    });
  }
}

function transformData(data) {
  let rtnData = {};
  rtnData.MDMkt = 'Coinbase';

  if (data.type === 'match') {
    rtnData.MDEntryType = 2;
  } else {
    rtnData.MDEntryType = data.side === 'buy' ? 0 : 1;
  }

  rtnData.MDEntryPx = parseFloat(data.price);
  rtnData.Symbol = data.product_id;
  rtnData.MDEntryTime = new Date(data.time);

  if (data.type === 'match') {
    rtnData.LastQty = parseFloat(data.size);
  } else if (data.type === 'open') {
    rtnData.MDEntrySize = parseFloat(data.remaining_size);
  }

  if (data.type === 'match') {
    rtnData.OrderID = [data.maker_order_id, data.taker_order_id];
    rtnData.TickDirection = data.side === 'sell' ? 0 : 2;
  } else {
    rtnData.OrderID = data.order_id;
  }



  return rtnData;
}


export { Coinbase as default };
