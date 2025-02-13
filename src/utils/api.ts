const GRAPHQL_ENDPOINT = 'https://rata.digitraffic.fi/api/v2/graphql/graphql';
const REST_ENDPOINT = 'https://rata.digitraffic.fi/api/v1/metadata/stations';

export async function fetchStations() {
  const query = `{
    stations(where:{passengerTraffic: {equals: true}}){name, shortCode}
  }`;

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch stations');
  }

  const data = await response.json();
  return data.data.stations;
}

export async function fetchTrains(stationCode = "HKI") {
 
  const where = 'departed_trains:0, departing_trains:100';
  /**
   * viewer {
      getStationsTrainsUsingGET(${where}, station: "${stationCode}", arrived_trains:0, arriving_trains:0) {
        operatorUICCode
        trainCategory
        trainType
        cancelled
        commuterLineID
        trainNumber
        timeTableRows {
          trainStopping
          stationShortCode
          type
          commercialStop
          commercialTrack
          cancelled
          scheduledTime
          liveEstimateTime
          actualTime
          differenceInMinutes
        }
      }
    }
   */
  const departureDate = new Date().toISOString().split('T')[0];
  const query = `{
  trainsByDepartureDate(
    departureDate:  "${departureDate}"
    where: {and: [{timeTableRows: {contains: {station: {shortCode: {equals: "PLA"}}}}}, {commuterLineid: {unequals: ""}},{cancelled:{equals:false}}]}
		
  ) {
    cancelled
    commuterLineid
    trainNumber
    timeTableRows(where: {and:[{cancelled:{equals:false}},{type:{equals:"DEPARTURE"}},{trainStopping:{equals:true}},]}) {
      trainStopping
      type
      commercialStop
      commercialTrack
      cancelled
      liveEstimateTime
      actualTime
      differenceInMinutes
      scheduledTime
      station {
        name
        shortCode
      }
    }
  }
}`;

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch trains', { cause: response.statusText });
  }

  const data = await response.json();
  return data.data.trainsByDepartureDate;
}