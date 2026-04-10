import {HttpFunction} from '@google-cloud/functions-framework';
import {BigQuery} from '@google-cloud/bigquery';

const LOCAL = process.env.LOCAL === 'true';

export const logFeatureClick: HttpFunction = async (req, res) => {
  res.set('Access-Control-Allow-Origin', "*")
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS'){
    res.status(204).send('');
  }else{
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const row = {
      featureId: req.body.id,
      ipAddress,
      lat: parseFloat(req.body.lat.toFixed(8)),
      lng: parseFloat(req.body.lng.toFixed(8)),
      language: req.body.language || 'en',
      sessionId: req.body.sessionId || null,
      timestamp: new Date(),
    };
    if(LOCAL){
      console.log('[LOCAL] featureClicks:', row);
    }else{
      const bigquery = new BigQuery();
      try{
        await bigquery
        .dataset('resourceMap')
        .table('featureClicks')
        .insert(row);
      }catch(error){
        // @ts-ignore
        console.log(error);
      }
    }
    res.status(200).send('OK');
  }
};
