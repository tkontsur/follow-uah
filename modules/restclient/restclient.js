import fetch from 'node-fetch';
import config from 'config';
import cron from 'node-cron';
import sortBy from 'lodash/sortBy.js';
import sumBy from 'lodash/sumBy.js';
import max from 'lodash/max.js';
import min from 'lodash/min.js';
import find from 'lodash/find.js';
import rates from '../database/rates.js';
import users from '../database/users';
import moment from 'moment';

class RestClient {
  constructor(bot) {
    this.state = [];
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

      console.log(`${new Date()}: Fetch triggered`);

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
    if (!this.nextHistory) {
      this.nextHistory = await rates.getEarliestDate();
    }

    console.log(`${new Date()}: Fetch history triggered`);
    this.nextHistory.add(-1, 'd');
    return this.fetchData(this.nextHistory.format('YYYY-MM-DD'));
  }

  start() {
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

  async updateState(result) {
    this.state = result;

    if (
      !this.stateYesterday ||
      this.stateYesterday.date.isSame(result.date, 'd')
    ) {
      const yesterday = result.date.clone().add(-1, 'd');
      this.stateYesterday = await rates.getRates(yesterday, result.type);
    }

    this.updateMetrics(result, this.stateYesterday);
  }

  updateMetrics(today, yesterday) {
    const changes = today.map((t) => {
      const y = find(yesterday, (x) => x.currency === t.currency);

      if (!y) {
        return {
          currency: t.currency,
          trend: 0
        };
      }

      // rate has changed direction since yesterday
      if (y.trendAsk * t.trendAsk < 0 || y.trendBid * t.trendBid < 0) {
        // minimum is more than 1% higher than maximum yesterday
        if (t.bid - y.maxAsk * 0.01 > y.maxAsk) {
          return {
            currency: t.currency,
            trend: 1
          };
        }

        // maximum is more than 1% lower than minimum yesterday
        if (t.ask + y.maxBid * 0.01 < y.maxBid) {
          return {
            currency: t.currency,
            trend: -1
          };
        }

        return {
          currency: t.currency,
          trend: 0
        };
      }
    });

    if (changes.some((r) => r.trend !== 0)) {
      const chats = users.getSubscribedChats('all');

      changes
        .filter((r) => r.trend !== 0)
        .forEach((change) => this.bot.notifyUsers(change, t, chats));
    }
  }
}

const restClient = new RestClient();
restClient.tests = {
  async history() {
    return await restClient.fetchHistory();
  },

  async getrates() {
    return await rates.getRates(new moment(new Date()).add(-1, 'd'), 'MB');
  },

  async allusers() {
    return await users.getSubscribedChats();
  },

  async compare() {
    const today = await this.getrates();

    setTimeout(
      () =>
        restClient.updateMetrics(today, [
          {
            currency: 'usd',
            ask: 26.09,
            bid: 26.06,
            trendAsk: -0.15,
            trendBid: -0.15,
            maxAsk: 26.09,
            minBid: 26.06
          },
          {
            currency: 'eur',
            ask: 30.09,
            bid: 30.06,
            trendAsk: 0.15,
            trendBid: 0.15,
            maxAsk: 30.09,
            minBid: 30.06
          }
        ]),
      1000
    );

    return 'Started';
  }
};

export default restClient;
