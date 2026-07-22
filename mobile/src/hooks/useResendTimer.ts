import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Countdown for an OTP "Resend" control. Call restart() right after a successful
 * signInWithOtp; render `Resend OTP in {secondsLeft}s` while !canResend, then a
 * "Resend OTP" button once canResend is true.
 */
export function useResendTimer(seconds = 60) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const restart = useCallback(() => {
    clear();
    setSecondsLeft(seconds);
    timer.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clear();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [seconds, clear]);

  useEffect(() => clear, [clear]);

  return { secondsLeft, canResend: secondsLeft === 0, restart };
}
