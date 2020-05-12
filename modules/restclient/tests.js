import moment from 'moment-timezone';
import restClient from './restclient.js';
import rates2 from '../database/rates-dynamo.js';
import users from '../database/users.js';
import { removeListener } from 'cluster';

export default {
  async fetchnow() {
    const server = await restClient.fetchData('2020-04-08');

    return `Server ${JSON.stringify(server)}`;
  },

  async getrates() {
    return await rates2.getDate('MB', 'usd', new moment('2020-04-08'));
  },

  async allusers() {
    return await users.getSubscribedChats();
  },

  async metrics() {
    console.log('*** Start instant metrics test ***');
    ['usd', 'eur'].forEach(async (c) => {
      const allData = await rates2.getEverything('MB', c);

      const count = allData.length;
      console.log(`Evaluating ${c}`);
      for (let i = 0; i < count - 2; i++) {
        const today = allData.slice(i, count - 1);

        const result = await restClient.updateMetrics(
          'MB',
          { [c]: today },
          true
        );
        const { date, ask, trendAsk, maxAsk } = today[0];
        console.log(
          `Result for ${date} (${ask}, T: ${trendAsk}, M: ${maxAsk}) trend ${result[c]}`
        );
      }
    });
    return 'Done';
  },

  async resethistory() {
    restClient.redisSet('nextHistory', new moment().format('YYYY-MM-DD'));
    restClient.nextHistory = new moment();
    return `Reset to ${new moment().format('YYYY-MM-DD')}`;
  },

  async revise() {
    restClient.reviseDay();
    return 'Done';
  }
};
