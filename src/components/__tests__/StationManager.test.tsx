import { render, fireEvent, act, waitFor } from '@testing-library/preact';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StationManager from '../StationManager';
import { fetchTrainsLeavingFromStation } from '../../utils/api';
import type { Station } from '../../types';
import { useState } from 'preact/hooks';
import type { Props } from '../StationManager';

// Mock translations
vi.mock('../../utils/translations', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'from': 'Mistä',
      'to': 'Mihin',
      'h1title': 'Lähijunien aikataulut reaaliaikaisesti',
      'hint': 'Valitse ensin lähtöasema',
      'closeHint': 'Sulje vihje',
      'locate': 'Paikanna',
      'swapDirection': 'Vaihda suuntaa',
      'loading': 'Ladataan...',
      'placeholder': 'placeholder',
    };
    return translations[key] || key;
  },
}));

// Mock useLanguageChange hook
vi.mock('../hooks/useLanguageChange', () => ({
  useLanguageChange: vi.fn(),
}));

// Mock fetchTrainsLeavingFromStation
vi.mock('../../utils/api', () => ({
  fetchTrainsLeavingFromStation: vi.fn(),
  fetchTrains: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('StationManager', () => {
  const mockStations: Station[] = [
    {
      name: 'Helsinki',
      shortCode: 'HKI',
      location: {
        latitude: 60.1699,
        longitude: 24.9384,
      },
    },
    {
      name: 'Tampere',
      shortCode: 'TPE',
      location: {
        latitude: 61.4978,
        longitude: 23.7609,
      },
    },
    {
      name: 'Turku',
      shortCode: 'TKU',
      location: {
        latitude: 60.4518,
        longitude: 22.2666,
      },
    },
  ];

  const mockDestinations: Station[] = [
    {
      name: 'Tampere',
      shortCode: 'TPE',
      location: {
        latitude: 61.4978,
        longitude: 23.7609,
      },
    },
  ];

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    (fetchTrainsLeavingFromStation as any).mockResolvedValue(mockDestinations);
  });

  it('shows loading state when fetching destinations', async () => {
    const { getByText, findByText, container } = render(<StationManagerTestWrapper stations={mockStations} />);

    // Select a station
    const fromInput = getByText('Mistä').nextElementSibling?.querySelector('input');
    if (fromInput) {
      fireEvent.focus(fromInput);
      fireEvent.input(fromInput, { target: { value: 'Helsinki' } });
      
      // Wait for the dropdown to appear
      await waitFor(() => {
        const dropdown = container.querySelector('.station-list-container .absolute');
        expect(dropdown).toBeInTheDocument();
      });

      // Find and click the station option
      const stationOption = await findByText('Helsinki (HKI)');
      fireEvent.click(stationOption);
    }

    // Check if loading state is shown
    expect(getByText((content) => content.includes('Ladataan'))).toBeInTheDocument();

    // Wait for destinations to load
    await waitFor(() => {
      expect(() => getByText((content) => content.includes('Ladataan'))).toThrow();
    });
  });

  it('updates available destinations when origin station is selected', async () => {
    const { getByText, findByText, container } = render(<StationManagerTestWrapper stations={mockStations} />);

    // Select origin station
    const fromInput = getByText('Mistä').nextElementSibling?.querySelector('input');
    if (fromInput) {
      fireEvent.focus(fromInput);
      fireEvent.input(fromInput, { target: { value: 'Helsinki' } });
      
      // Wait for the dropdown to appear
      await waitFor(() => {
        const dropdown = container.querySelector('.station-list-container .absolute');
        expect(dropdown).toBeInTheDocument();
      });

      // Find and click the station option
      const stationOption = await findByText('Helsinki (HKI)');
      fireEvent.click(stationOption);
    }

    // Wait for destinations to load
    await waitFor(() => {
      expect(fetchTrainsLeavingFromStation).toHaveBeenCalledWith('HKI');
    });

    // Check if destination list is updated
    const toInput = getByText('Mihin').nextElementSibling?.querySelector('input');
    if (toInput) {
      fireEvent.focus(toInput);
      fireEvent.input(toInput, { target: { value: '' } });
      
      // Wait for the dropdown to appear
      await waitFor(() => {
        const dropdown = container.querySelector('.station-list-container .absolute');
        expect(dropdown).toBeInTheDocument();
      });

      // Find and verify the destination option
      const destinationOption = await findByText('Tampere (TPE)');
      expect(destinationOption).toBeInTheDocument();
    }
  });

  it('handles error when fetching destinations', async () => {
    (fetchTrainsLeavingFromStation as any).mockRejectedValue(new Error('Failed to fetch'));

    // Suppress error log for this test
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { getByText, findByText, container } = render(<StationManagerTestWrapper stations={mockStations} />);

    // Select origin station
    const fromInput = getByText('Mistä').nextElementSibling?.querySelector('input');
    if (fromInput) {
      fireEvent.focus(fromInput);
      fireEvent.input(fromInput, { target: { value: 'Helsinki' } });
      
      // Wait for the dropdown to appear
      await waitFor(() => {
        const dropdown = container.querySelector('.station-list-container .absolute');
        expect(dropdown).toBeInTheDocument();
      });

      // Find and click the station option
      const stationOption = await findByText('Helsinki (HKI)');
      fireEvent.click(stationOption);
    }

    // Wait for error to occur and fallback to all stations
    await waitFor(() => {
      expect(fetchTrainsLeavingFromStation).toHaveBeenCalledWith('HKI');
    });

    // Check if all stations are available in destination list
    const toInput = getByText('Mihin').nextElementSibling?.querySelector('input');
    if (toInput) {
      fireEvent.focus(toInput);
      fireEvent.input(toInput, { target: { value: '' } });
      
      // Wait for the dropdown to appear
      await waitFor(() => {
        const dropdown = container.querySelector('.station-list-container .absolute');
        expect(dropdown).toBeInTheDocument();
      });

      // Find and verify both stations are available
      const tampereOption = await findByText('Tampere (TPE)');
      const turkuOption = await findByText('Turku (TKU)');
      expect(tampereOption).toBeInTheDocument();
      expect(turkuOption).toBeInTheDocument();
    }

    errorSpy.mockRestore();
  });

  it('clears destination if it becomes unavailable', async () => {
    // Set initial destination
    localStorageMock.setItem('selectedDestination', 'TKU');

    const { getByText } = render(
      <StationManager 
        stations={mockStations} 
        initialFromStation="HKI"
        initialToStation="TKU"
      />
    );

    // Wait for destinations to load and verify destination is cleared
    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('selectedDestination');
    });
  });
});

// Custom test wrapper to force openList to 'from'
function StationManagerTestWrapper(props: Props) {
  const [openList, setOpenList] = useState<'from' | 'to' | null>('from');
  return (
    <StationManager {...props} openList={openList} setOpenList={setOpenList} />
  );
} 