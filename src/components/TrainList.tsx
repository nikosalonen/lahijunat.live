/** @format */

import { memo } from "preact/compat";
import { useCallback, useEffect, useState } from "preact/hooks";
import { useLanguageChange } from "../hooks/useLanguageChange";
import type { Station, Train } from "../types";
import { fetchTrains } from "../utils/api";
import { t } from "../utils/translations";
import { hapticLight } from "../utils/haptics";
import ProgressCircle from "./ProgressCircle";
import TrainCard from "./TrainCard";
import TrainListSkeleton from "./TrainListSkeleton";
import ErrorState from "./ErrorState";

interface Props {
  stationCode: string;
  destinationCode: string;
  stations: Station[];
}

const MemoizedTrainCard = memo(TrainCard);
const INITIAL_TRAIN_COUNT = 15;
const FADE_DURATION = 3000; // 3 seconds to match the animation duration

export default function TrainList({
  stationCode,
  destinationCode,
  stations,
}: Props) {
  useLanguageChange();
  const [state, setState] = useState({
    trains: [] as Train[],
    loading: true,
    initialLoad: true,
    error: null as {
      type: "network" | "api" | "notFound" | "rateLimit" | "generic";
      message?: string;
    } | null,
    progress: 100,
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [animationPhase, setAnimationPhase] = useState(0);
  const [displayedTrainCount, setDisplayedTrainCount] =
    useState(INITIAL_TRAIN_COUNT);
  const [departedTrains, setDepartedTrains] = useState<Set<string>>(new Set());

  const loadTrains = useCallback(async () => {
    try {
      if (state.initialLoad) {
        setState((prev) => ({ ...prev, loading: true }));
      }
      setState((prev) => ({ ...prev, progress: 100 }));

      const trainData = await fetchTrains(stationCode, destinationCode);
      setCurrentTime(new Date());
      setState((prev) => ({
        ...prev,
        trains: trainData,
        error: null,
        loading: false,
        initialLoad: false,
      }));
    } catch (err) {
      console.error("Error loading trains:", err);

      // Determine error type based on error message or properties
      let errorType: "network" | "api" | "notFound" | "rateLimit" | "generic" =
        "generic";
      let errorMessage: string | undefined;

      if (err instanceof Error) {
        const message = err.message.toLowerCase();
        if (message.includes("network") || message.includes("fetch")) {
          errorType = "network";
        } else if (
          message.includes("rate limit") ||
          message.includes("too many")
        ) {
          errorType = "rateLimit";
        } else if (message.includes("not found") || message.includes("404")) {
          errorType = "notFound";
        } else if (message.includes("api") || message.includes("server")) {
          errorType = "api";
        }
        errorMessage = err.message;
      }

      setState((prev) => ({
        ...prev,
        error: { type: errorType, message: errorMessage },
        loading: false,
        initialLoad: false,
      }));
    }
  }, [stationCode, destinationCode, state.initialLoad]);

  // Reset displayed count and departed trains when stations change
  useEffect(() => {
    setDisplayedTrainCount(INITIAL_TRAIN_COUNT);
    setDepartedTrains(new Set());
  }, [stationCode, destinationCode]);

  const handleTrainDeparted = useCallback((trainNumber: string) => {
    setTimeout(() => {
      setDepartedTrains((prev) => new Set([...prev, trainNumber]));
    }, FADE_DURATION);
  }, []);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    let updateInterval: NodeJS.Timeout | undefined;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = (elapsed % 2500) / 2500; // 2.5s animation duration
      setAnimationPhase(progress);
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    // Function to calculate time until next even second (:00 or :30)
    const getTimeUntilNextUpdate = () => {
      const now = new Date();
      const seconds = now.getSeconds();
      const milliseconds = now.getMilliseconds();
      const timeUntilNextHalfMinute =
        (30 - (seconds % 30)) * 1000 - milliseconds;
      return timeUntilNextHalfMinute;
    };

    // Initial data load
    loadTrains();

    // Update current time every second
    const timeUpdateInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Schedule next update at the next even second
    const updateTimeout = setTimeout(() => {
      loadTrains();
      // Then set up regular interval
      updateInterval = setInterval(() => {
        loadTrains();
      }, 30000); // 30 seconds
    }, getTimeUntilNextUpdate());

    // Progress bar update interval
    const progressInterval = setInterval(() => {
      setState((prev) => ({
        ...prev,
        progress: Math.max(0, prev.progress - 100 / 30),
      }));
    }, 1000); // Update progress every second

    return () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(updateTimeout);
      if (updateInterval) clearInterval(updateInterval);
      clearInterval(progressInterval);
      clearInterval(timeUpdateInterval);
    };
  }, [loadTrains]);

  if (state.loading && state.initialLoad) {
    return <TrainListSkeleton />;
  }

  if (state.error) {
    return (
      <div className="max-w-4xl mx-auto">
        <ErrorState
          type={state.error.type}
          message={state.error.message}
          onRetry={loadTrains}
          className="min-h-[300px] flex items-center justify-center"
        />
      </div>
    );
  }

  const fromStation = stations.find((s) => s.shortCode === stationCode);
  const toStation = stations.find((s) => s.shortCode === destinationCode);

  const displayedTrains = (state.trains || [])
    .filter((train) => !departedTrains.has(train.trainNumber))
    .slice(0, displayedTrainCount);
  const hasMoreTrains = (state.trains || []).length > displayedTrainCount;

  return (
    <div>
      <div class="max-w-4xl mx-auto space-y-6 px-0 sm:px-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-2">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 order-2 sm:order-1">
            {t("departingTrains")}{" "}
            <span class="sm:hidden">
              {stationCode} → {destinationCode}
            </span>
            <span class="hidden sm:inline">
              {fromStation?.name} → {toStation?.name}
            </span>
          </h2>
          <div class="self-end sm:self-auto order-1 sm:order-2">
            <ProgressCircle progress={state.progress} />
          </div>
        </div>
        <div
          class="grid auto-rows-fr gap-4 px-2 transition-[grid-row,transform] duration-700 ease-in-out"
          style={{
            "--animation-phase": animationPhase,
            "grid-template-rows": `repeat(${displayedTrains.length}, minmax(0, 1fr))`,
          }}
        >
          {displayedTrains.map((train, index) => (
            <div
              key={train.trainNumber}
              class="transition-[transform,opacity] duration-700 ease-in-out"
              style={{
                "grid-row": `${index + 1}`,
              }}
            >
              <MemoizedTrainCard
                train={train}
                stationCode={stationCode}
                destinationCode={destinationCode}
                currentTime={currentTime}
                onDepart={() => handleTrainDeparted(train.trainNumber)}
              />
            </div>
          ))}
        </div>
        {hasMoreTrains && (
          <div class="flex justify-center mt-4">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setDisplayedTrainCount((prev) => prev + INITIAL_TRAIN_COUNT);
              }}
              class="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 dark:active:bg-blue-800 transition-all duration-150 shadow-sm hover:shadow-md active:shadow-lg active:scale-95 touch-manipulation select-none font-medium"
            >
              {t("showMore")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
