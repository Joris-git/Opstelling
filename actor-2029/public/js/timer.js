export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function createCountdown({ startedAtIso, durationSec, onTick, onAlarmStart, onTimeUp }) {
  let intervalId = null;
  let alarmFired = false;
  let timeUpFired = false;
  const startedAtMs = startedAtIso ? new Date(startedAtIso).getTime() : Date.now();

  function computeRemaining() {
    const elapsedSec = (Date.now() - startedAtMs) / 1000;
    return Math.max(0, durationSec - elapsedSec);
  }

  function tick() {
    const remaining = computeRemaining();
    if (onTick) onTick(remaining);
    if (!alarmFired && remaining <= 60 && remaining > 0) {
      alarmFired = true;
      if (onAlarmStart) onAlarmStart();
    }
    if (!timeUpFired && remaining <= 0) {
      timeUpFired = true;
      if (onTimeUp) onTimeUp();
    }
  }

  function start() {
    tick();
    intervalId = setInterval(tick, 250);
  }

  function stop() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  return { start, stop, computeRemaining, isTimeUp: () => timeUpFired, isAlarm: () => alarmFired };
}
