import { render, fireEvent, act } from '@testing-library/preact';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TrainCard from '../TrainCard';
import type { Train } from '../../types';

// Mock translations
vi.mock('../utils/translations', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'late': 'Myöhässä',
      'minutes': 'minuuttia',
      'departure': 'Lähtöaika',
      'loading': 'Ladataan...',
      'duration': 'Kesto',
      'hours': 'tuntia',
      'minutes_short': 'm',
      'hours_short': 'h',
      'track': 'Raide',
      'departingSoon': 'Lähtee pian',
    };
    return translations[key] || key;
  },
}));

// Mock useLanguageChange hook
vi.mock('../hooks/useLanguageChange', () => ({
  useLanguageChange: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('TrainCard', () => {
  const mockTrain: Train = {
    trainNumber: '123',
    cancelled: false,
    operatorUICCode: '1234',
    trainCategory: 'Commuter',
    trainType: 'Commuter',
    commuterLineID: 'A',
    timeTableRows: [
      {
        stationShortCode: 'HKI',
        type: 'DEPARTURE',
        scheduledTime: '2024-03-20T10:00:00.000Z',
        liveEstimateTime: '2024-03-20T10:00:00.000Z',
        actualTime: '2024-03-20T10:00:00.000Z',
        differenceInMinutes: 0,
        trainStopping: true,
        commercialStop: true,
        commercialTrack: '1',
        cancelled: false,
        station: {
          name: 'Helsinki',
          shortCode: 'HKI',
          location: {
            latitude: 60.1699,
            longitude: 24.9384,
          },
        },
      },
      {
        stationShortCode: 'TPE',
        type: 'ARRIVAL',
        scheduledTime: '2024-03-20T11:00:00.000Z',
        liveEstimateTime: '2024-03-20T11:00:00.000Z',
        actualTime: '2024-03-20T11:00:00.000Z',
        differenceInMinutes: 0,
        trainStopping: true,
        commercialStop: true,
        commercialTrack: '2',
        cancelled: false,
        station: {
          name: 'Tampere',
          shortCode: 'TPE',
          location: {
            latitude: 61.4978,
            longitude: 23.7609,
          },
        },
      },
    ],
  };

  const defaultProps = {
    train: mockTrain,
    stationCode: 'HKI',
    destinationCode: 'TPE',
    currentTime: new Date('2024-03-20T09:55:00.000Z'),
    onDepart: vi.fn(),
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders train information correctly', () => {
    const { getByText, getByLabelText } = render(<TrainCard {...defaultProps} />);
    
    expect(getByLabelText('Juna A')).toBeInTheDocument();
    expect(getByText('5 min')).toBeInTheDocument();
  });

  it('calls onDepart when train departs', () => {
    const futureTime = new Date('2024-03-20T10:01:00.000Z');
    const { rerender } = render(
      <TrainCard {...defaultProps} currentTime={futureTime} />
    );

    expect(defaultProps.onDepart).toHaveBeenCalled();
  });

  it('handles cancelled trains correctly', () => {
    const cancelledTrain = { ...mockTrain, cancelled: true };
    const { container } = render(
      <TrainCard {...defaultProps} train={cancelledTrain} />
    );

    expect(container.firstChild).toHaveClass('bg-red-50');
  });

  it('handles double tap to highlight train', () => {
    const { container } = render(<TrainCard {...defaultProps} />);
    const card = container.firstChild as HTMLElement;

    // Simulate double tap
    fireEvent.click(card);
    fireEvent.click(card);

    expect(localStorageMock.setItem).toHaveBeenCalled();
    expect(container.firstChild).toHaveClass('animate-soft-blink-highlight');
  });

  it('removes highlight after departure', () => {
    const highlightedTrain = {
      ...mockTrain,
      trainNumber: '123',
    };

    // Set initial highlight in localStorage
    localStorageMock.setItem(
      'highlightedTrains',
      JSON.stringify({
        '123': {
          highlighted: true,
          removeAfter: new Date('2024-03-20T10:10:00.000Z').toISOString(),
        },
      })
    );

    const { container, rerender } = render(
      <TrainCard {...defaultProps} train={highlightedTrain} />
    );

    // Initial state should be highlighted
    expect(container.firstChild).toHaveClass('animate-soft-blink-highlight');

    // Move time forward past the removal time
    rerender(
      <TrainCard
        {...defaultProps}
        train={highlightedTrain}
        currentTime={new Date('2024-03-20T10:11:00.000Z')}
      />
    );

    // Highlight should be removed
    expect(container.firstChild).not.toHaveClass('animate-soft-blink-highlight');
  });

  it('shows correct duration between stations', () => {
    const { getByLabelText } = render(<TrainCard {...defaultProps} />);
    
    // Duration should be 1 hour
    expect(getByLabelText('Kesto 1 tuntia 0 minuuttia')).toBeInTheDocument();
  });

  it('handles delayed trains correctly', () => {
    const delayedTrain = {
      ...mockTrain,
      timeTableRows: [
        {
          ...mockTrain.timeTableRows[0],
          differenceInMinutes: 15,
          liveEstimateTime: '2024-03-20T10:15:00.000Z',
        },
        mockTrain.timeTableRows[1],
      ],
    };

    const { getByText } = render(
      <TrainCard {...defaultProps} train={delayedTrain} />
    );

    expect(getByText('+15 min')).toBeInTheDocument();
  });
}); 