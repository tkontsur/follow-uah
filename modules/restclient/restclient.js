import fetch from 'node-fetch';
import config from 'config';
import cron from 'node-cron';
import { sortBy, sumBy, max, min } from 'lodash';
import rates from '../database/rates.js';
import moment from 'moment';

class RestClient {
  constructor() {
    this.state = [];
    this.parseMBResult = this.parseMBResult.bind(this);
    this.fetchData = this.fetchData.bind(this);
    this.fetchHistory = this.fetchHistory.bind(this);
    this.updateMetrics = this.updateMetrics.bind(this);
  }

  async fetchData(date) {
    try {
      const url = config.get('api.mburl');
      const token = config.get('api.token');

      console.log('Fetch triggered');

      const response = await fetch(
        `${url}/${token}/${date ? `${date}/` : ''}`,
        {
          headers: {
            'user-agent': 'FollowUahBot/1.0 (https://t.me/FollowUahBot)'
          }
        }
      );
      const json = await response.json();
      const nextState = this.parseMBResult(json);

      if (nextState.length === 0) {
        return;
      }

      if (
        !this.state ||
        !this.state.length ||
        !this.state[0].pointDate.isSame(nextState[0].pointDate)
      ) {
        nextState.forEach(rates.addRate, rates);
      }

      return nextState;
    } catch (e) {
      console.error(e);
    }
  }

  async fetchHistory() {
    console.log('Fetch history triggered');
    return await rates
      .getEarliestDate()
      .then((d) => this.fetchData(d.add(-1, 'd').format('YYYY-MM-DD')));
  }

  start() {
    const options = {
      scheduled: true,
      timezone: config.get('default_timezone')
    };

    this.updates = cron.schedule(
      '30 10-18 * * 1-5',
      () => this.fetchData(),
      options
    );

    if (config.get('api.getHistory')) {
      this.historyUpdates = cron.schedule(
        '30 0-9,19-23 * * *',
        this.fetchHistory,
        options
      );
    }
  }

  parseMBResult(data) {
    const type = 'MB';
    const usd = this.parseByCurrency(data, 'usd', type);
    const eur = this.parseByCurrency(data, 'eur', type);

    return [usd, eur];
  }

  parseByCurrency(data, currency, type) {
    const latest = sortBy(
      data.filter((r) => r.currency === currency),
      'date'
    );
    const { date, pointDate, ask, bid } = latest[latest.length - 1];

    const result = {
      date: new moment(date),
      pointDate: new moment(pointDate),
      currency,
      ask,
      bid,
      type,
      trendAsk: sumBy(latest, ({ trendAsk }) => +trendAsk),
      trendBid: sumBy(latest, ({ trendBid }) => +trendBid),
      maxAsk: max(latest.map(({ ask }) => +ask)),
      minBid: min(latest.map(({ bid }) => +bid))
    };

    return result;
  }

  async getCurrentState() {
    if (!this.state.length) {
      this.state = await this.fetchData();
      return this.state;
    }

    return this.state;
  }

  updateMetrics() {}
}

const restClient = new RestClient();
restClient.tests = {
  async history() {
    return await restClient.fetchHistory();
  },

  async getrate() {
    return await rates.getRate(new moment(new Date()), 'USD', 'MB');
  }
};

export default restClient;
