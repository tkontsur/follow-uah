import moment from 'moment-timezone';
import config from 'config';
import UahTelegramBot from './modules/telegrambot/telegrambot.js';
import restClient from './modules/restclient/restclient.js';
//import rates from './modules/database/rates.js';

moment.tz.setDefault(config.get('default_timezone'));
moment.locale('uk');

const telegramBot = new UahTelegramBot();

restClient.start();
restClient.bot = telegramBot;

/*rates.connect().then(() => {
  restClient.start();
  restClient.bot = telegramBot;
});
*/
