import axios, { Method } from 'axios';
import APIError from './types/error';
import Quote from './types/quote';
import QuoteQuery from './types/quote-query';
import SubscribeQuery from './types/subscribe';
import Booking from './types/booking';

export enum ServerURL {
  development = 'https://development-partner-api.hikoala.co',
  staging = 'https://staging-partner-api.hikoala.co',
  production = 'https://partner-api.hikoala.co',
  default = 'https://development-partner-api.hikoala.co',
}

export enum Version {
  v0 = 'v0',
  v1 = 'v1',
  default = 'v0',
}

class Options {
  target: ServerURL = ServerURL.default;

  token: string;

  version: Version = Version.default;
}

export default class Koala {
  version = Version.default;
  target: string = ServerURL.default;
  token: string;

  constructor(options: Partial<Options>) {
    this.token = process.env.KOALA_PARTNER_TOKEN || options.token;
    this.target =
      options.target ?? (process.env.KOALA_PARTNER_API || ServerURL.default);
    this.version = options.version ?? Version.default;
  }

  private async sendRequest(
    method: Method,
    path: string,
    input?: any,
  ): Promise<any> {
    const api = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
    });

    api.interceptors.request.use((config) => {
      config.headers.Authorization = `Bearer ${this.token}`;
      config.headers.Accept = 'application/json';
      if (input) config.headers['Content-Type'] = 'application/json';
      return config;
    }, Promise.reject);

    api.interceptors.response.use(
      (response) => response,
      (error) => {
        return Promise.reject(APIError.fromJSON(error.response.data));
      },
    );
    const response = await api.request({
      method,
      url: `${this.baseURL}/${path}`,
      data: input,
    });
    if (response.status > 299) {
      throw APIError.fromJSON(response.data);
    } else {
      return response.data;
    }
  }

  get baseURL(): string {
    return `${this.target}/partner/${this.version}`;
  }

  async quotes(query: QuoteQuery): Promise<Quote[]> {
    const res = await this.sendRequest('GET', '/flights/quotes', query);
    return Object.values(res).map(Quote.fromJSON);
  }

  async subscribe(query: SubscribeQuery): Promise<Booking> {
    const res = await this.sendRequest('POST', '/flights/subscribe', query);
    return Booking.fromJSON(res);
  }
}