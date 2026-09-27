// Concepts shown in the hero's vector space. Each cluster stands for a region
// of embedding space; the hero types its query and the query point flies there.
export interface Cluster {
  query: string;
  labels: string[];
  color: string; // CSS custom property
  center: [number, number, number];
}

export const CLUSTERS: Cluster[] = [
  {
    query: 'where do we retry failed requests?',
    labels: ['retryWithBackoff()', 'Ky.#calculateRetryDelay', 'shouldRetry(error)'],
    color: '--brand',
    center: [0.55, -0.35, 0.2],
  },
  {
    query: 'how is the auth token refreshed?',
    labels: ['HTTPDigestAuth.handle_401', 'refreshAccessToken()', 'AuthBase.__call__'],
    color: '--pink',
    center: [-0.6, -0.25, -0.35],
  },
  {
    query: 'parse the JSON response body',
    labels: ['Ky.#parseJson', 'Response.json()', 'decodeBody(buf)'],
    color: '--sky',
    center: [-0.15, 0.55, 0.5],
  },
  {
    query: 'which proxy comes from the environment?',
    labels: ['get_environ_proxies()', 'resolve_proxies()', 'should_bypass_proxies'],
    color: '--lime',
    center: [0.45, 0.5, -0.45],
  },
  {
    query: 'send a file as the response',
    labels: ['res.sendFile', 'sendfile.onerror', 'res.attachment()'],
    color: '--brand-hi',
    center: [-0.55, 0.35, 0.05],
  },
];
