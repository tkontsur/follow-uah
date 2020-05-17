import fetch from 'node-fetch';
import config from 'config';
import Cron from 'cron';
import sortBy from 'lodash/sortBy.js';
import sumBy from 'lodash/sumBy.js';
import max from 'lodash/max.js';
import min from 'lodash/min.js';
import moment from 'moment-timezone';
import redis from 'redis';
//import rates from '../database/rates.js';
import users from '../database/users.js';
import logger from '../utils/logger.js';
import instantMetrics from '../metrics/instantMetrics.js';
import ratesHistory from '../database/ratesHistory.js';
import rawRates from '../database/rawRates.js';
import rates2 from '../database/rates-dynamo.js';
import { getRateKey } from '../database/utils.js';

const CronJob = Cron.CronJob;

class RestClient {
  constructor(bot) {
    this.state = {
      MB: {
        usd: [],
        eur: []
      }
    };

    const redisClient = redis.createClient();
    redisClient.on('error', (error) => {
      logger.error('Failed to connect to Redis');
      logger.error(error);
      this.redisGet = (key) => Promise.resolve(this.state[key]);
      this.redisSet = (key, value) => (this.state[key] = value);
    });

    this.bot = bot;
    this.parseMBResult = this.parseMBResult.bind(this);
    this.fetchData = this.fetchData.bind(this);
    this.fetchHistory = this.fetchHistory.bind(this);
    this.updateState = this.updateState.bind(this);
    this.updateMetrics = this.updateMetrics.bind(this);
    //this.reviseHistory = this.reviseHistory.bind(this);
    this.reviseDay = this.reviseDay.bind(this);

    this.redisGet = (key) =>
      new Promise((resolve, reject) =>
        redisClient.get(key, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        })
      );
    this.redisSet = (key, value) =>
      new Promise((resolve, reject) =>
        redisClient.set(key, value, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        })
      );
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

      rawRates.addDay(
        json.filter(({ currency }) => currency !== 'rub'),
        'MB'
      );

      const nextState = this.parseMBResult(json);

      /*if (
        !this.state.MB.usd.length ||
        this.state.MB.usd[0].pointDate.isBefore(nextState[0].pointDate)
      ) {
        nextState.forEach(rates.addRate, rates);
      }*/

      return nextState;
    } catch (e) {
      logger.error(e);
    }
  }

  /*async reviseHistory() {
    try {
      const next =
        new moment(await this.redisGet('nextHistory')) ||
        this.nextHistory.clone();
      next.add(-1, 'd');
      const isoDate = next.format('YYYY-MM-DD');
      const url = config.get('api.mburl');
      const token = config.get('api.token');

      logger.info(`${isoDate}: Fetch revised history triggered`);
      this.nextHistory = next;
      this.redisSet('nextHistory', next.format('YYYY-MM-DD'));

      const response = await fetch(`${url}/${token}/${isoDate}`, {
        headers: {
          'user-agent': 'FollowUahBot/1.0 (https://t.me/FollowUahBot)'
        }
      });
      const json = await response.json();

      if (!json.length || !new moment(json[0].date).isSame(next, 'd')) {
        return;
      }

      rawRates.addDay(
        json.filter(({ currency }) => currency !== 'rub'),
        'MB'
      );

      const aggregate = this.parseMBResult(json);
      const history = await rates.getRates(next, 'MB');

      aggregate.forEach((ar) => {
        const hr = history.find(({ currency }) => currency === ar.currency);
        if (Math.abs(ar.trendAsk - hr.trendAsk) > 0.0001) {
          logger.info(`Error for ${isoDate}: trendAsk is wrong`);
          rates.addRate(ar);
          return;
        }
        if (Math.abs(ar.trendBid - hr.trendBid) > 0.0001) {
          logger.info(`Error for ${isoDate}: trendBid is wrong`);
          rates.addRate(ar);
          return;
        }
        if (Math.abs(ar.ask - hr.ask) > 0.0001) {
          logger.info(`Error for ${isoDate}: ask is wrong`);
          rates.addRate(ar);
          return;
        }
        if (Math.abs(ar.bid - hr.bid) > 0.0001) {
          logger.info(`Error for ${isoDate}: bid is wrong`);
          rates.addRate(ar);
          return;
        }
        if (Math.abs(ar.maxAsk - hr.maxAsk) > 0.0001) {
          logger.info(`Error for ${isoDate}: maxAsk is wrong`);
          rates.addRate(ar);
          return;
        }
        if (Math.abs(ar.minBid - hr.minBid) > 0.0001) {
          logger.info(`Error for ${isoDate}: minBid is wrong`);
          rates.addRate(ar);
          return;
        }
      });

      if (!config.get('api.getHistory')) {
        this.historyUpdates.stop();
      }
    } catch (e) {
      logger.error('Failed to revise history');
      logger.error(e);
    }
  }*/

  async fetchHistory() {
    if (!this.nextHistory) {
      this.nextHistory = await rates2.getEarliestDate();
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
    const timezone = config.get('default_timezone');

    this.updates = new CronJob(
      '30 10-18 * * 1-5',
      () => this.fetchData().then(this.updateState),
      null,
      true,
      timezone
    );

    new CronJob('0 19 * * 1-5', this.reviseDay, null, true, timezone, this);

    /*if (config.get('api.getHistory')) {
      this.historyUpdates = new CronJob((
        '10,50 * * * *',
        this.reviseHistory,
        null, true, timezone, this
      );

      this.redisGet('nextHistory').then((h) => {
        if (!h) {
          this.redisSet(
            'nextHistory',
            new moment().add(1, 'd').format('YYYY-MM-DD')
          );
        }
      });
    }*/

    const init = [];

    Object.keys(this.state).forEach((t) => {
      Object.keys(this.state[t]).forEach((c) => init.push(this.initRate(t, c)));
    });

    Promise.all(init).then(() => {
      if (
        that.state.MB.usd[0].pointDate.add(2, 'h').isBefore(new moment()) &&
        new moment().hour() > 9 &&
        new moment().hour() < 19
      ) {
        that.fetchData().then(that.updateState);
      }
    });
  }

  async initRate(type, currency) {
    const latestUpdate = await ratesHistory.getLatestRate(type, currency);

    return rates2
      .getSince(type, currency, latestUpdate.date.clone().add(-1, 'd'))
      .then((res) => {
        this.state[type][currency] = res;
        return res;
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
        this.state.MB[v.currency] = [v];
        return;
      }

      if (st[0].date.isSame(v.date, 'd')) {
        st[0] = v;
      } else {
        st.unshift(v);
      }
    });

    this.updateMetrics('MB', this.state.MB);
  }

  async updateMetrics(type, state, dontSend) {
    const metrics = Object.keys(state).reduce(
      (result, c) => ({
        ...result,
        [c]: instantMetrics.updateMetrics(type, state[c])
      }),
      {}
    );
    const toSend = Object.keys(metrics).filter(
      (c) => metrics[c] !== 0 && this.notSentToday(type, c)
    );

    if (toSend.length > 0 && !dontSend) {
      logger.info('Metrics have triggered');

      const sendUsd = !!metrics.usd;
      const allUsers = await users.getSubscribedChats('all');

      if (sendUsd) {
        this.bot.notifyUsers(metrics.usd, state.usd, allUsers, dontSend);
      } else {
        toSend
          .filter((c) => c !== 'usd')
          .forEach((c) =>
            this.bot.notifyUsers(metrics[c], state[c], allUsers, dontSend)
          );
      }

      toSend.forEach((c) => {
        const { type, date, maxAsk, minBid } = state[c][0];

        if (!dontSend) {
          logger.info(
            `Recording history: ${type}, ${date.format(
              'YYYY-MM-DD'
            )}, ${c}, ${maxAsk}, ${minBid}, ${metrics[c]}`
          );

          ratesHistory.record({
            type,
            currency: c,
            date: date.format('YYYY-MM-DD'),
            trend: metrics[c],
            maxAsk,
            minBid
          });
        }

        this.state[type][c].splice(2);
      });
    }

    return metrics;
  }

  reviseDay() {
    const lastTriggered = ratesHistory.getAllTriggered();
    const errors = Object.keys(this.state.MB)
      .map((currency) => ({
        currency,
        result: instantMetrics.updateMetrics('MB', this.state.MB[currency])
      }))
      .filter(
        ({ currency, result }) =>
          lastTriggered[getRateKey(currency, 'MB')] !== result
      );

    errors.forEach(({ currency, result }) =>
      logger.warn(`Day review: Result for ${currency} changed to ${result}`)
    );

    if (!errors.length) {
      logger.info('Day review: no inconsistencies today.');
    }
  }

  notSentToday(type, currency) {
    const lastTriggered = ratesHistory.getAllTriggered();

    if (currency) {
      return lastTriggered[getRateKey(currency, type)].date.isBefore(
        new moment(),
        'd'
      );
    } else {
      return Object.keys(lastTriggered)
        .map((k) => lastTriggered[k].date.isBefore(new moment(), 'd'))
        .reduce((r, k) => r || k, false);
    }
  }
}

const restClient = new RestClient();

export default restClient;
