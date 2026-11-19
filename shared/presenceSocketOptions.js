export const presenceSocketOptions = organizationId => ({
  // One persistent connection avoids polling requests using an obsolete session.
  transports: ['websocket', 'polling'],
  tryAllTransports: true,
  auth: { organizationId },
});
