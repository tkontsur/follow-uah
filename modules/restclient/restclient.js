import fetch from 'node-fetch';
import config from 'config';
import cron from 'node-cron';
import { sortBy, sumBy, maxBy, minBy } from 'lodash';
import rates from '../database/rates.js';
import moment from 'moment';

class RestClient {
  constructor() {
    this.state = [];
    this.parseMBResult = this.parseMBResult.bind(this);
    this.fetchData = this.fetchData.bind(this);
    this.updateMetrics = this.updateMetrics.bind(this);
  }

  async fetchData() {
    try {
      const url = config.get('api.mburl');
      const token = config.get('api.token');
      const response = await fetch(`${url}/${token}/`, {
        headers: {
          'user-agent': 'FollowUahBot/1.0 (https://t.me/FollowUahBot)'
        }
      });
      const json = await response.json();
      const nextState = this.parseMBResult(json);

      if (nextState.length === 0) {
        return;
      }

      if (
        this.state &&
        this.state.length &&
        this.state[0].date === nextState[0].date
      ) {
      }

      return nextState;
    } catch (e) {
      console.error(e);
    }
  }

  start() {
    const options = {
      scheduled: true,
      timezone: config.get('default_timezone')
    };

    this.updates = cron.schedule(
      '30 10-18 * * 1-5',
      () => this.fetchData,
      options
    );
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
      maxAsk: maxBy(latest, 'ask'),
      minBid: minBy(latest, 'bid')
    };

    return result;
  }

  async getCurrentState() {
    if (!this.state.length) {
      return await this.fetchData();
    }

    return this.state;
  }

  updateMetrics() {}
}

const restClient = new RestClient();

export default restClient;
