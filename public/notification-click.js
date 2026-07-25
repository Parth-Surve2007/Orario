self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/?view=dashboard&focus=attendanceReview';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingClient = allClients.find((client) => 'focus' in client);

    if (existingClient) {
      await existingClient.focus();
      existingClient.postMessage({ type: 'OPEN_ATTENDANCE_REVIEW' });
      return;
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
