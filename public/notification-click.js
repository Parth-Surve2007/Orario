self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/?view=dashboard&focus=attendanceReview';
  const messageType = targetUrl.includes('view=timetable')
    ? 'OPEN_TIMETABLE'
    : 'OPEN_ATTENDANCE_REVIEW';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingClient = allClients.find((client) => 'focus' in client);

    if (existingClient) {
      await existingClient.focus();
      existingClient.postMessage({ type: messageType });
      return;
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
