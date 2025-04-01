import {HttpFunction} from '@google-cloud/functions-framework';
import {BigQuery} from '@google-cloud/bigquery';

export const logGeocode: HttpFunction = async (req, res) => {
  res.set('Access-Control-Allow-Origin', "*")
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS'){
    res.status(204).send('');
  }else{

    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const bigquery = new BigQuery();
    try{
      await bigquery
      .dataset('resourceMap')
      .table('geocodes')
      .insert({
	address: req.body.address,
	ipAddress,
	lat: parseFloat(req.body.lat.toFixed(8)),
	lng: parseFloat(req.body.lng.toFixed(8)),
	timestamp: new Date(),
      });
    }catch(error){
      // @ts-ignore
      console.log(error.errors[0]);
    }
    res.status(200).send('OK');
  }
};
