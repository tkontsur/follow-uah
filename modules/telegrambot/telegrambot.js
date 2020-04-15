import TelegramBot from 'node-telegram-bot-api';
import config from 'config';
import moment from 'moment';
import users from '../database/users.js';
import restClient from '../restclient/restclient.js';

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
        this.bot.sendMessage(
          msg.chat.id,
          rates
            .map(
              (
                { currency, ask, bid, pointDate, trendAsk, trendBid },
                index,
                all
              ) =>
                `${currency.toUpperCase()}: ${ask} ${getTrend(
                  trendAsk
                )} ${bid} ${getTrend(trendBid)}${
                  index === all.length - 1
                    ? `\nОстаннє оновлення: ${pointDate.format(
                        'YYYY-MM-DD HH:mm'
                      )}`
                    : ''
                }`
            )
            .join('\n')
        )
      )
      .catch((err) => {
        console.error(err);
        this.bot.sendMessage(msg.chat.id, 'Помилка :(');
      });
  }

  triggerTest(msg, match) {
    if (typeof restClient.tests[match[1]] === 'function') {
      restClient.tests[match[1]]().then((result) =>
        this.bot.sendMessage(msg.chat.id, JSON.stringify(result))
      );
    }
  }
}

function getTrend(value) {
  return `(${Math.round((value + Number.EPSILON) * 10000) / 10000})`;
}
