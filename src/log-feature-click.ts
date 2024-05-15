import {HttpFunction} from '@google-cloud/functions-framework';
import {BigQuery} from '@google-cloud/bigquery';

export const logFeatureClick: HttpFunction = async (req, res) => {
  if(req.method === 'OPTIONS'){
    res.set('Access-Control-Allow-Origin', "*")
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
  }else{
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const bigquery = new BigQuery();
    try{
      await bigquery
      .dataset('resourceMap')
      .table('featureClicks')
      .insert({
	featureId: req.body.id,
	ipAddress,
	lat: parseFloat(req.body.lat.toFixed(8)),
	lng: parseFloat(req.body.lng.toFixed(8)),
	timestamp: new Date(),
      });
    }catch(error){
      // @ts-ignore
      console.log(error);
    }
    res.status(200).send('OK');
  }
};
