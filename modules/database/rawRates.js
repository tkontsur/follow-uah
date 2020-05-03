import AWS from 'aws-sdk';
import config from 'config';
import moment from 'moment';
import logger from '../utils/logger.js';

class RawRates {
  constructor() {
    AWS.config.update({ region: config.get('aws.region') });

    this.s3 = new AWS.S3({ apiVersion: '2006-03-01' });
  }

  addDay(rates) {
    if (!rates || !rates.length) {
      return;
    }

    const date = moment(rates[0].date).format('YYYY-MM-DD');
    const uploadParams = {
      Bucket: config.get('aws.bucket'),
      Key: moment(rates[0].date).format('YYYY-MM-DD'),
      Body: JSON.stringify(rates)
    };

    this.s3
      .upload(uploadParams)
      .promise()
      .then(() => logger.info(`Added data for ${date} to S3`))
      .catch((err) => {
        logger.error(`Failed to upload ${date} to S3`);
        logger.error(err);
      });
  }
}

const rawRates = new RawRates();

export default rawRates;
