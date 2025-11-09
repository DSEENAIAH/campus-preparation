import React, { useState, useEffect, useRef } from 'react';

const PerformanceMonitor = ({ enabled = false }) => {
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    lastRenderTime: 0,
    avgRenderTime: 0,
    memoryUsage: 0,
    apiCalls: 0,
    errors: 0
  });
  
  const renderStartTime = useRef(Date.now());
  const renderTimes = useRef([]);
  const apiCallCount = useRef(0);
  const errorCount = useRef(0);
  const updateInterval = useRef(null);

  // Fixed: Use interval-based updates instead of render-based updates
  useEffect(() => {
    if (!enabled) return;

    // Update metrics every 1 second instead of every render
    updateInterval.current = setInterval(() => {
      const currentTime = Date.now();
      const renderTime = currentTime - renderStartTime.current;
      
      setMetrics(prev => ({
        ...prev,
        renderCount: prev.renderCount + 1,
        lastRenderTime: renderTime,
        memoryUsage: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0,
        apiCalls: apiCallCount.current,
        errors: errorCount.current
      }));
      
      renderStartTime.current = currentTime;
    }, 1000);

    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [enabled]); // Only re-run if enabled changes

  if (!enabled) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      fontFamily: 'monospace'
    }}>
      <div>Renders: {metrics.renderCount}</div>
      <div>Last: {metrics.lastRenderTime}ms</div>
      <div>Avg: {metrics.avgRenderTime}ms</div>
      <div>Memory: {metrics.memoryUsage}MB</div>
      <div>API: {metrics.apiCalls}</div>
      <div>Errors: {metrics.errors}</div>
    </div>
  );
};

export default PerformanceMonitor;