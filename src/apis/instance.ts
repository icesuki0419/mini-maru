import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { token } from '@/utils/token';

export const maru = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

maru.interceptors.request.use((config) => {
  const accessToken = token.getAccess();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

const reissue = async () => {
  const { data } = await axios.patch<{ accessToken: string; refreshToken: string }>(
    '/api/auth',
    null,
    { headers: { 'Refresh-Token': token.getRefresh() ?? '' } },
  );
  token.set(data.accessToken, data.refreshToken);
  return data.accessToken;
};

let reissuePromise: Promise<string> | null = null;

const reissueOnce = () => {
  if (!reissuePromise) {
    reissuePromise = reissue()
      .catch((reissueError) => {
        token.clear();
        alert('로그인이 만료되었습니다. 다시 로그인해주세요.');
        window.location.href = '/login';
        throw reissueError;
      })
      .finally(() => {
        reissuePromise = null;
      });
  }
  return reissuePromise;
};

maru.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isAuthRequest = originalRequest?.url === '/auth';

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;
      const accessToken = await reissueOnce();
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return maru(originalRequest);
    }

    return Promise.reject(error);
  },
);