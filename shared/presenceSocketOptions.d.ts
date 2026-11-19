export function presenceSocketOptions(organizationId: string): {
  transports: string[];
  tryAllTransports: boolean;
  auth: { organizationId: string };
};
