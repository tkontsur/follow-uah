import UahTelegramBot from './modules/telegrambot/telegrambot.js';
import restClient from './modules/restclient/restclient.js';

const telegramBot = new UahTelegramBot();

restClient.start();
restClient.bot = telegramBot;
