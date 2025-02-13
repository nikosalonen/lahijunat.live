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
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Add utility function to check if train is departing soon (within 5 minutes)
  const isDepartingSoon = (scheduledTime: string) => {
    const departure = new Date(scheduledTime);
    const now = new Date();
    const diffMinutes = (departure.getTime() - now.getTime()) / (1000 * 60);
    return diffMinutes >= -1 && diffMinutes <= 5;
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
        // Only show loading spinner on initial load
        if (initialLoad) {
          setLoading(true);
        }

        const trainData = await fetchTrains(stationCode, destinationCode);
        setTrains(trainData);
        setError(null);
      } catch (err) {
        setError('Failed to load train data');
        console.error(err);
      } finally {
        setLoading(false);
        setInitialLoad(false);
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

  // Only show loading spinner on initial load
  if (loading && initialLoad) {
    return <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>;
  }

  if (error) {
    return <div class="text-red-500 text-center p-4">{error}</div>;
  }

  return (
    <div class="max-w-4xl mx-auto space-y-6 p-4">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">Lähtevät junat {stationCode} → {destinationCode}</h2>
      <div class="grid gap-4">
        {trains.map((train) => {
          const departureRow = train.timeTableRows.find(
            row => row.stationShortCode === stationCode && row.type === "DEPARTURE"
          );
          const minutesToDeparture = departureRow ? formatMinutesToDeparture(departureRow.scheduledTime) : null;
          const departingSoon = departureRow && isDepartingSoon(departureRow.scheduledTime);

          return (
            <div
              key={`${train.trainNumber}`}
              class={`p-4 border rounded-lg shadow-sm transition-all hover:shadow-md relative
                ${train.cancelled ? 'bg-red-50 border-red-200' : 
                  minutesToDeparture !== null && minutesToDeparture < -1 ? 'bg-gray-100 border-gray-300 opacity-60' :
                  departingSoon ? 'bg-white border-gray-200 animate-soft-blink' : 
                  'bg-white border-gray-200'}`}
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  {/* Train identifier */}
                  {train.commuterLineID && (
                    <div class="h-12 w-12 bg-green-100 text-green-800 rounded-full flex items-center justify-center text-lg font-medium">
                      {train.commuterLineID}
                    </div>
                  )}
                  
                  {/* Main train info */}
                  <div class="space-y-1">
                    {/* Time information */}
                    {train.timeTableRows.map((row) => {
                      if (row.stationShortCode === stationCode && row.type === "DEPARTURE") {
                        const departureTime = new Date(row.scheduledTime).toLocaleTimeString('fi-FI', {
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        
                        
                        
                        const arrivalRow = train.timeTableRows.find(
                          r => r.stationShortCode === destinationCode && r.type === "ARRIVAL"
                        );
                        const arrivalTime = arrivalRow?.scheduledTime;
                        const duration = arrivalTime ? 
                          Math.round((new Date(arrivalTime).getTime() - new Date(row.scheduledTime).getTime()) / (1000 * 60)) : 
                          null;

                        return (
                          <div class="flex flex-col gap-1" key={row.scheduledTime}>
                            
                            <div class="flex items-center gap-2">
                              <span class="text-lg font-medium text-gray-800">
                                {departureTime} 
                                <span class="mx-2 text-gray-400">→</span> 
                                {arrivalTime ? 
                                  new Date(arrivalTime).toLocaleTimeString('fi-FI', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : ''}
                              </span>
                              {duration && (
                                <span class="text-sm text-gray-500">
                                  ({Math.floor(duration / 60)}h {duration % 60}m)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>

                <div class="flex items-center gap-2 text-sm text-gray-600">
                  {/* Track info */}
                  {train.timeTableRows.map((row) => {
                    if (row.stationShortCode === stationCode && row.type === "DEPARTURE") {
                      return (
                        <div key={row.scheduledTime} class="absolute top-4 right-4 flex flex-col items-end gap-1">
                          <span class="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-sm">
                            Track {row.commercialTrack}
                          </span>
                          {/* Departure countdown */}
                          {departureRow && formatMinutesToDeparture(departureRow.scheduledTime) <= 30 && formatMinutesToDeparture(departureRow.scheduledTime) >= 0 && (
                            <span class={`font-medium text-lg ${
                              formatMinutesToDeparture(departureRow.scheduledTime) >= 0 
                                ? 'text-green-600' 
                                : 'text-gray-500'
                            }`}>
                              {formatMinutesToDeparture(departureRow.scheduledTime)} min
                            </span>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}