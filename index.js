import UahTelegramBot from './modules/telegrambot/telegrambot.js';
import restClient from './modules/restclient/restclient.js';

new UahTelegramBot();

restClient.start();
