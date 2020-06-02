import moment from 'moment-timezone';
import config from 'config';
import logger from '../utils/logger.js';
import users from '../database/users.js';
import ratesHistory from '../database/ratesHistory.js';
import TelegramBot from '../telegrambot/telegrambot.js';
import { getRateKey, fix } from '../database/utils.js';

class Messengers {
  constructor() {
    this.telegrambot = new TelegramBot();
    this.send = this.send.bind(this);
  }

  async onRatesUpdate(metrics, state, type) {
    const toSend = Object.keys(metrics).filter(
      (c) => metrics[c] !== 0 && this.notSentToday(type, c)
    );

    if (toSend.length > 0) {
      logger.info('Metrics have triggered');

      const sendUsd = !!metrics.usd;
      const allUsers = await users.getSubscribedChats('all');
      const telegramChannel = config.get('sm.telegramChannel');

      if (sendUsd) {
        this.send(
          this.getMessageText(metrics.usd, state.usd),
          telegramChannel ? [...allUsers, telegramChannel] : allUsers
        );
      } else {
        toSend
          .filter((c) => c !== 'usd')
          .forEach((c) =>
            this.send(this.getMessageText(metrics[c], state[c]), allUsers)
          );
      }
    }
  }

  getMessageText(metrics, state) {
    const { currency } = state[0];
    const yesterdayText =
      state[0].date.diff(state[1].date, 'd') === 1
        ? 'Вчора'
        : state[1].pointDate.format('D MMMM');

    switch (metrics) {
      case 1:
      case 2:
      case 3:
        return `${currency.toUpperCase()} почав рости.
${yesterdayText}: ${fix(state[1].bid)} ${fix(state[1].ask)}
Сьогодні: ${fix(state[0].bid)} ${fix(state[0].ask)}`;
      case -1:
      case -2:
      case -3:
        return `${currency.toUpperCase()} почав падати.
${yesterdayText}: ${fix(state[1].bid)} ${fix(state[1].ask)}
Сьогодні: ${fix(state[0].bid)} ${fix(state[0].ask)}`;
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

  send(message, users) {
    if (!config.get('noMessages')) {
      this.telegrambot.notifyUsers(message, users);
    } else {
      console.log(`Sending: ${message}`);
    }
  }
}

export default new Messengers();
