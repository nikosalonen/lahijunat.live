// src/components/StationManager.tsx
import { useState } from 'preact/hooks';
import type { Station } from '../types';
import StationList from './StationList';
import TrainList from './TrainList';

interface Props {
  stations: Station[];
}

export default function StationManager({ stations }: Props) {
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);

  const handleOriginSelect = (station: Station) => {
    setSelectedOrigin(station.shortCode);
  };

  const handleDestinationSelect = (station: Station) => {
    setSelectedDestination(station.shortCode);
  };

  return (
    <div>
      <div>
        <h3>Select Origin Station</h3>
        <StationList 
          stations={stations} 
          onStationSelect={handleOriginSelect} 
        />
      </div>
      <div>
        <h3>Select Destination Station</h3>
        <StationList 
          stations={stations} 
          onStationSelect={handleDestinationSelect} 
        />
      </div>
      {selectedOrigin && selectedDestination && (
        <TrainList stationCode={selectedOrigin} destinationCode={selectedDestination} />
      )}
    </div>
  );
}