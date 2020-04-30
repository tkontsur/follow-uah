import fetch from 'node-fetch';
import config from 'config';
import cron from 'node-cron';
import sortBy from 'lodash/sortBy.js';
import sumBy from 'lodash/sumBy.js';
import max from 'lodash/max.js';
import min from 'lodash/min.js';
import keyBy from 'lodash/keyBy.js';
import groupBy from 'lodash/groupBy.js';
import uniq from 'lodash/uniq.js';
import moment from 'moment-timezone';
import rates from '../database/rates.js';
import users from '../database/users.js';
import logger from '../utils/logger.js';
import instantMetrics from '../metrics/instantMetrics.js';

class RestClient {
  constructor(bot) {
    this.state = {
      MB: {
        usd: [],
        eur: []
      },
      lastTriggered: null
    };
    this.bot = bot;
    this.parseMBResult = this.parseMBResult.bind(this);
    this.fetchData = this.fetchData.bind(this);
    this.fetchHistory = this.fetchHistory.bind(this);
    this.updateState = this.updateState.bind(this);
    this.updateMetrics = this.updateMetrics.bind(this);
  }

  async fetchData(date) {
    try {
      const url = config.get('api.mburl');
      const token = config.get('api.token');

      logger.info(`${new moment().format()}: Fetch triggered`);

      const response = await fetch(
        `${url}/${token}/${date ? `${date}/` : ''}`,
        {
          headers: {
            'user-agent': 'FollowUahBot/1.0 (https://t.me/FollowUahBot)'
          }
        }
      );
      const json = await response.json();

      if (!json.length) {
        return [];
      }

      const nextState = this.parseMBResult(json);

      if (
        !this.state.MB.usd.length ||
        !this.state.MB.usd[0].pointDate.isSame(nextState[0].pointDate)
      ) {
        nextState.forEach(rates.addRate, rates);
      }

      return nextState;
    } catch (e) {
      logger.error(e);
    }
  }

  async fetchHistory() {
    if (!this.nextHistory) {
      this.nextHistory = await rates.getEarliestDate();
    }

    logger.info(`${new moment().format()}: Fetch history triggered`);
    this.nextHistory.add(-1, 'd');
    const result = await this.fetchData(this.nextHistory.format('YYYY-MM-DD'));
    logger.info(`Got data for ${this.nextHistory.format('YYYY-MM-DD')}`);

    if (!config.get('api.getHistory')) {
      this.historyUpdates.stop();
    }
    return result;
  }

  start() {
    const that = this;
    const options = {
      scheduled: true,
      timezone: config.get('default_timezone')
    };

    this.updates = cron.schedule(
      '30 10-18 * * 1-5',
      () => this.fetchData().then(this.updateState),
      options
    );

    if (config.get('api.getHistory')) {
      this.historyUpdates = cron.schedule(
        '30 0-9,19-23 * * *',
        this.fetchHistory,
        options
      );
    }

    rates.getLatestDates(4).then((response) => {
      const today = response[0].date;
      const yesterday = response[response.length - 1].date;
      const currencies = uniq(response.map((r) => r.currency));

      currencies.forEach((c) => {
        that.state.MB[c] = response.filter((r) => r.currency === c);
      });

      if (
        response[0].pointDate.add(2, 'h').isBefore(new moment()) &&
        new moment().hour() > 9 &&
        new moment().hour() < 19
      ) {
        that.fetchData().then(that.updateState);
      }
    });
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
      ask: +ask,
      bid: +bid,
      type,
      trendAsk: sumBy(latest, ({ trendAsk }) => +trendAsk),
      trendBid: sumBy(latest, ({ trendBid }) => +trendBid),
      maxAsk: max(latest.map(({ ask }) => +ask)),
      minBid: min(latest.map(({ bid }) => +bid))
    };

    return result;
  }

  async getCurrentState() {
    if (!this.state.MB.usd.length) {
      const nextState = await this.fetchData();
      return nextState;
    }

    const { usd, eur } = this.state.MB;
    return [usd[0], eur[0]];
  }

  async updateState(result) {
    result.forEach((v) => {
      const st = this.state.MB[v.currency];
      if (!st || !st.length) {
        this.state.MB[v.currency] = v;
        return;
      }

      if (st[0].date.isSame(v.date, 'd')) {
        st[0] = v;
      } else {
        st.unshift(v);
      }
    });

    this.updateMetrics(this.state.MB);
  }

  async updateMetrics(state, dontSend) {
    const metrics = {};
    Object.keys(state).forEach(
      (c) => (metrics[c] = instantMetrics.updateMetrics(state[c]))
    );

    if (!dontSend && Object.values(metrics).some((v) => v !== 0)) {
      logger.info('Metrics have triggered');
      if (this.state.lastTriggered && this.lastTriggered.isBefore(new moment(), 'd')) {
        const sendUsd = metrics.usd !== 0;
        const allUsers = await users.getSubscribedChats('all');
        this.lastTriggered = new moment();
        logger.info(allUsers.length);
        
        if (sendUsd) {
          this.bot.notifyUsers(metrics.usd, state.usd, allUsers);
        } else {
          Object.keys(metrics)
            .filter((c) => metrics[c] !== 0)
            .forEach((c) => this.bot.notifyUsers(metrics[c], state[c], allUsers));
        }
      }
    }

    return metrics;
  }
}

const restClient = new RestClient();
restClient.tests = {
  async fetchnow() {
    const server = await restClient.fetchData('2020-04-08');
    
    return `Server ${JSON.stringify(server)}`;
  },

  async getrates() {
    return await rates.getRates(new moment('2020-04-08'), 'MB');
  },

  async allusers() {
    return await users.getSubscribedChats();
  },

  async metrics() {
    const allData = await rates.getEverything();
    const currencies = groupBy(allData, 'currency');
    console.log('*** Start instant metrics test ***');

    for (const c in currencies) {
      const list = currencies[c];
      const count = list.length;
      console.log(`Evaluating ${c}`);
      for (let i = 0; i < count - 2; i++) {
        const today = list.slice(i, count - 1);

        const result = await restClient.updateMetrics({ [c]: today }, true);
        console.log(
          `Result for ${today[0].date} (${today[0].ask}, ${today[0].trendAsk}) trend ${result[c]}`
        );
      }
    }
    return 'Done';
  }
};

export default restClient;
