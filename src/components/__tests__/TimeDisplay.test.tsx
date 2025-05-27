import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/preact'
import TimeDisplay from '../TimeDisplay'
import type { TimeTableRow } from '../../types'

describe('TimeDisplay', () => {
  const mockStation = {
    name: 'Helsinki',
    shortCode: 'HKI',
    location: {
      latitude: 60.1699,
      longitude: 24.9384
    }
  }

  const mockDepartureRow: TimeTableRow = {
    stationShortCode: 'HKI',
    scheduledTime: '2024-03-20T10:00:00Z',
    liveEstimateTime: '2024-03-20T10:05:00Z',
    actualTime: undefined,
    cancelled: false,
    trainStopping: true,
    commercialStop: true,
    type: 'DEPARTURE',
    commercialTrack: '1',
    station: mockStation
  }

  const mockArrivalRow: TimeTableRow = {
    stationShortCode: 'TPE',
    scheduledTime: '2024-03-20T10:30:00Z',
    liveEstimateTime: '2024-03-20T10:35:00Z',
    actualTime: undefined,
    cancelled: false,
    trainStopping: true,
    commercialStop: true,
    type: 'ARRIVAL',
    commercialTrack: '2',
    station: {
      name: 'Tampere',
      shortCode: 'TPE',
      location: {
        latitude: 61.4978,
        longitude: 23.7610
      }
    }
  }

  it('renders without delay when no live estimate', () => {
    render(
      <TimeDisplay
        departureRow={mockDepartureRow}
        arrivalRow={mockArrivalRow}
        timeDifferenceMinutes={0}
      />
    )
    expect(screen.queryByText('+5 min')).not.toBeInTheDocument()
  })

  it('renders with delay indicator when train is late', () => {
    render(
      <TimeDisplay
        departureRow={mockDepartureRow}
        arrivalRow={mockArrivalRow}
        timeDifferenceMinutes={5}
      />
    )
    expect(screen.getByText('+5 min')).toBeInTheDocument()
  })

  it('renders with cancelled styling when train is cancelled', () => {
    render(
      <TimeDisplay
        departureRow={mockDepartureRow}
        arrivalRow={mockArrivalRow}
        timeDifferenceMinutes={0}
        isCancelled={true}
      />
    )
    const container = screen.getByText('12.00').closest('span.text-lg')
    expect(container).toHaveClass('line-through')
  })
}) 