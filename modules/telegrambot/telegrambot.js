import TelegramBot from 'node-telegram-bot-api';
import config from 'config';
import moment from 'moment';
import users from '../database/users.js';
import restClient from '../restclient/restclient.js';
import { invokeTest } from '../restclient/tests.js';
import logger from '../utils/logger.js';

export default class UahTelegramBot {
  constructor() {
    const token = config.get('telegram.token');

    // Create a bot that uses 'polling' to fetch new updates
    this.bot = new TelegramBot(token, { polling: true });

    this.bot.onText(/\/start/, this.addUser.bind(this));
    this.bot.onText(/\/stop/, this.removeUser.bind(this));
    this.bot.onText(/\/current/, this.getCurrentRate.bind(this));
    this.bot.onText(/\/trigger (.+)/, this.triggerTest.bind(this));
  }

  addUser(msg) {
    const chatId = msg.chat.id;

    users.addUser({
      subscription: 'all',
      chatId,
      firstName: msg.from.first_name,
      joinedAt: new moment().format('YYYY-MM-DD')
    });
    this.bot.sendMessage(chatId, config.get('telegram.text.welcome'));
  }

  removeUser(msg) {
    const chatId = msg.chat.id;

    users.removeUser(chatId);
    this.bot.sendMessage(chatId, config.get('telegram.text.goodbye'));
  }

  getCurrentRate(msg) {
    restClient
      .getCurrentState()
      .then((rates) =>
        this.bot.sendMessage(msg.chat.id, rates.map(this.writeRate).join('\n'))
      )
      .catch((err) => {
        logger.error(err);
        this.bot.sendMessage(msg.chat.id, 'Помилка :(');
      });
  }

  notifyUsers(change, state, chats, dontSend) {
    const { currency } = state[0];
    const message = `${currency.toUpperCase()} почав ${
      change > 0 ? 'рости' : 'падати'
    }.
Вчора: ${fix(state[1].bid)} ${fix(state[1].ask)}
Сьогодні: ${fix(state[0].bid)} (${fix(state[0].trendBid)}) ${fix(
      state[0].ask
    )} (${fix(state[0].trendAsk)})`;

    if (!dontSend) {
      chats.forEach((user) => this.bot.sendMessage(user, message));
    } else {
      console.log(message);
    }
  }

  writeRate(
    { currency, ask, bid, pointDate, trendAsk, trendBid },
    index = -1,
    all = []
  ) {
    return `${currency.toUpperCase()}: ${bid} (${fix(trendBid)}) ${ask} (${fix(
      trendAsk
    )})${
      index === all.length - 1
        ? `\nОстаннє оновлення: ${pointDate.format(
            'DD MMMM YYYY HH:mm'
          )}\nБільше на http://www.minfin.com.ua/currency/`
        : ''
    }`;
  }

  triggerTest(msg, match) {
    invokeTest(match[1]).then((response) =>
      this.bot.sendMessage(msg.chat.id, response)
    );
  }
}

function fix(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
