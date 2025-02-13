// src/components/StationManager.tsx
import { useState } from 'preact/hooks';
import type { Station } from '../types';
import StationList from './StationList';
import TrainList from './TrainList';

interface Props {
  stations: Station[];
}

export default function StationManager({ stations }: Props) {
  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  const handleStationSelect = (station: Station) => {
    setSelectedStation(station.shortCode);
  };

  return (
    <div>
      <StationList 
        stations={stations} 
        onStationSelect={handleStationSelect} 
      />
      {selectedStation && (
        <TrainList stationCode={selectedStation} />
      )}
    </div>
  );
}