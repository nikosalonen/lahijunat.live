import { useState, useEffect } from 'preact/hooks';
import type { Train } from '../types';
import { fetchTrains } from '../utils/api';

interface Props {
  stationCode: string;
  destinationCode: string;
}

export default function TrainList({ stationCode, destinationCode }: Props) {
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Add utility function to check if train is departing soon (within 5 minutes)
  const isDepartingSoon = (scheduledTime: string) => {
    const departure = new Date(scheduledTime);
    const now = new Date();
    const diffMinutes = (departure.getTime() - now.getTime()) / (1000 * 60);
    return diffMinutes >= 0 && diffMinutes <= 5;
  };

  // Add utility function to format minutes
  const formatMinutesToDeparture = (scheduledTime: string) => {
    const departure = new Date(scheduledTime);
    const diffMinutes = Math.round((departure.getTime() - currentTime.getTime()) / (1000 * 60));
    return diffMinutes;
  };

  useEffect(() => {
    async function loadTrains() {
      try {
        setLoading(true);

        const trainData = await fetchTrains(stationCode, destinationCode);
        console.log(trainData);
        setTrains(trainData);
        setError(null);
      } catch (err) {
        setError('Failed to load train data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadTrains();
    // Refresh data every minute
    const interval = setInterval(loadTrains, 60000);

    // Update current time every 10 seconds
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, [stationCode, destinationCode]);

  if (loading) {
    return <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>;
  }

  if (error) {
    return <div class="text-red-500 text-center p-4">{error}</div>;
  }

  return (
    <div class="max-w-4xl mx-auto space-y-6 p-4">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">Departing Trains</h2>
      <div class="grid gap-4">
        {trains.map((train) => {
          const departureRow = train.timeTableRows.find(
            row => row.stationShortCode === stationCode && row.type === "DEPARTURE"
          );
          const departingSoon = departureRow && isDepartingSoon(departureRow.scheduledTime);
          console.log(departingSoon);
          
          return (
            <div
              key={`${train.trainNumber}`}
              class={`p-6 border rounded-xl shadow-sm transition-all hover:shadow-md
                ${train.cancelled ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}
                ${departingSoon ? 'animate-soft-blink' : ''}`}
            >
              <div class="flex justify-between items-center">
                <div class="space-y-2">
                  <div class="flex items-center gap-3">
                    {train.commuterLineID && (
                      <span class="px-4 py-2 bg-green-100 text-green-800 rounded-full text-lg font-medium h-full flex items-center">
                        {train.commuterLineID} {train.trainNumber}
                      </span>
                    )}
                  </div>
                  {train.timeTableRows.map((row) => {
                    if (row.stationShortCode === stationCode && row.type === "DEPARTURE") {
                      return (
                        <div class="flex items-center gap-2" key={row.scheduledTime}>
                          <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                            Track {row.commercialTrack}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })}

                  {train.timeTableRows.map((row) => {
                    // Show departure and arrival times together
                    if (row.stationShortCode === stationCode && row.type === "DEPARTURE") {
                      const departureTime = new Date(row.scheduledTime).toLocaleTimeString('fi-FI', {
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      
                      const minutesToDeparture = formatMinutesToDeparture(row.scheduledTime);
                      const showCountdown = minutesToDeparture <= 30 && minutesToDeparture >= 0;
                      
                      const arrivalTime = train.timeTableRows.find(
                        r => r.stationShortCode === destinationCode && r.type === "ARRIVAL"
                      )?.scheduledTime;

                      return (
                        <div class="space-y-2" key={row.scheduledTime}>
                          <div class="flex items-center gap-2">
                            <span class="text-gray-600 font-medium">
                              {stationCode} {departureTime} →  {arrivalTime ? 
                                new Date(arrivalTime).toLocaleTimeString('fi-FI', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : ''} {destinationCode}
                            </span>
                            {showCountdown && (
                              <span class="text-sm text-green-600 font-medium">
                                ({minutesToDeparture} min)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>

                {train.cancelled && (
                  <span class="text-red-600 font-medium text-sm">
                    Cancelled
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}