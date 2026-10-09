import { useCallback, useEffect, useState } from 'react';
import { DEMO_POSITION } from './demoLocation';

const messages = {
  1: 'Bạn chưa cho phép truy cập vị trí. Hãy bật quyền vị trí cho GoBus trong trình duyệt rồi thử lại.',
  2: 'Chưa xác định được vị trí của bạn. Kiểm tra dịch vụ vị trí trên máy rồi thử lại.',
  3: 'Lấy vị trí mất quá nhiều thời gian. Vui lòng thử lại.',
};

function readPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Trình duyệt này không hỗ trợ lấy vị trí.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (
          !Number.isFinite(coords.latitude) ||
          Math.abs(coords.latitude) > 90 ||
          !Number.isFinite(coords.longitude) ||
          Math.abs(coords.longitude) > 180
        ) {
          reject(
            new Error('Vị trí nhận được không hợp lệ. Vui lòng thử lại.'),
          );
          return;
        }
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        });
      },
      (error) => {
        reject(
          new Error(
            messages[error.code] || 'Không lấy được vị trí. Vui lòng thử lại.',
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

export function useCurrentPosition(initialMode = 'demo') {
  const [mode, setMode] = useState(initialMode);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({
    status:
      initialMode === 'demo'
        ? 'success'
        : initialMode === 'manual'
          ? 'idle'
          : 'loading',
    position: initialMode === 'demo' ? DEMO_POSITION : null,
    error: '',
  });

  useEffect(() => {
    if (mode !== 'device' && mode !== 'device-fallback') return;
    let active = true;
    readPosition()
      .then((position) => {
        if (active) setState({ status: 'success', position, error: '' });
      })
      .catch((error) => {
        if (active && mode === 'device-fallback') {
          setMode('demo');
          setState({ status: 'success', position: DEMO_POSITION, error: '' });
          return;
        }
        if (active)
          setState({
            status: 'error',
            position: null,
            error: error.message,
          });
      });
    return () => {
      active = false;
    };
  }, [attempt, mode]);
  function locate(fallback = false) {
    setMode(fallback ? 'device-fallback' : 'device');
    setState({ status: 'loading', position: null, error: '' });
    setAttempt((value) => value + 1);
  }
  const select = useCallback((position) => {
    setMode('manual');
    setState({ status: 'success', position, error: '' });
  }, []);
  function clear() {
    setMode('manual');
    setState({ status: 'idle', position: null, error: '' });
  }
  return { ...state, mode, locate, select, clear };
}
