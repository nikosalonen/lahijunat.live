import { useState, useEffect } from 'preact/hooks';
import type { Train } from '../types';
import { fetchTrains } from '../utils/api';

interface Props {
  stationCode: string;
}

export default function TrainList({ stationCode }: Props) {
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



  useEffect(() => {
    async function loadTrains() {
      try {
        setLoading(true);

        const trainData = await fetchTrains(stationCode);
        console.log(trainData)
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
    return () => clearInterval(interval);
  }, [stationCode]);

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
        {trains.map((train) => (
          <div
            key={`${train.trainNumber}`}
            class={`p-6 border rounded-xl shadow-sm transition-all hover:shadow-md
              ${train.cancelled ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}
          >
            <div class="flex justify-between items-center">
              <div class="space-y-2">
                <div class="flex items-center gap-3">
                  <span class="font-mono text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    {train.trainType}
                  </span>

                  {train.commuterLineid && (
                    <span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {train.commuterLineid}
                    </span>
                  )}
                </div>

                {train.timeTableRows.map((row) => {


                 if(row.stationShortCode === stationCode) { 
                  return (
                    <div class="flex items-center gap-2" key={row.scheduledTime}>
                      <svg
                        class="w-4 h-4 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span class="text-gray-600 font-medium">
                      {new Date(row.scheduledTime).toLocaleTimeString('fi-FI', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  )
                }
                })}
              </div>

              {train.cancelled && (
                <span class="text-red-600 font-medium text-sm">
                  Cancelled
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}