const EventEmitter = require("events").EventEmitter;
const WebSocket = require('ws');

class Coinbase extends EventEmitter {
  constructor(options) {
    super();
    this.ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
    this.registerCallbacks();
  }

  registerCallbacks() {
    this.ws.on('open', () => {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        product_id: 'BTC-USD'
      }));
    });

    this.ws.on('message', (data) => {
      data = JSON.parse(data);
      if (data.type === 'match') {
        console.log(data);
      }
      this.emit('message', {
        eventType: data.type,
        data: transformData(data)
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
  } else if (data.type === 'received') {
    rtnData.MDEntrySize = parseFloat(data.size);
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
