/**
 * Get city, region, and country from IP address
 * @param {string} ip - IP address to lookup
 * @returns {Promise<Object>} Location data with city, region, country
 */

interface LocationTypes {
  ip: string;
  city: string;
  region: string;
  country: string;
}

export const getLocationByIp = async (ip: string): Promise<LocationTypes> => {
  try {
    const cleanIp = ip.replace('::ffff:', '');
    if (cleanIp === '127.0.0.1' || cleanIp === '::1') {
      return {
        ip: cleanIp,
        city: 'Local',
        region: 'Local',
        country: 'Local',
      };
    }

    // Native fetch, not axios: axios's fetch adapter sets `cache: 'default'`,
    // which workerd rejects with "Unsupported cache mode", so every axios call
    // throws before leaving the Worker.
    const response = await fetch(`http://ip-api.com/json/${cleanIp}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`ip-api returned ${response.status}`);
    }

    const data = (await response.json()) as {
      status?: string;
      message?: string;
      city?: string;
      regionName?: string;
      country?: string;
    };

    if (data.status === 'fail') {
      throw new Error(data.message);
    }

    return {
      ip: cleanIp,
      city: data.city ?? 'Unknown',
      region: data.regionName ?? 'Unknown',
      country: data.country ?? 'Unknown',
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('IP location lookup failed:', error.message);
    }
    return {
      ip: ip,
      city: 'Unknown',
      region: 'Unknown',
      country: 'Unknown',
    };
  }
};
