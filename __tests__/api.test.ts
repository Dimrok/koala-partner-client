import _ from 'lodash';
import { Koala } from '../src/client';
import {
  Place,
  MinimalAttendant,
  MinimalLeg,
  QuoteQuery,
  AgeRange,
  MinimalFlight,
  DateTime,
  Quote,
  SubscribeQuery,
  Client,
  Booking,
  Attendant,
  Flight,
  Leg,
  APIError,
} from '../src/types';

let client: Koala;
let quoteQuery: QuoteQuery;

describe('#API', () => {
  describe('not logged', () => {
    beforeEach(() => {
      client = new Koala({});
    });

    it('should return 401', async () => {
      await expect(client.quotes(undefined)).rejects.toEqual(
        new APIError({
          status: 401,
          message: 'you do not have access to this resource',
          source: 'self',
        }),
      );
    });
  });

  describe('logged', () => {
    beforeEach(() => {
      client = new Koala({
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiVWx5c3NlIiwiZW1haWwiOiJjb250YWN0QHVseXNzZS50cmF2ZWwiLCJlbnYiOiJzdGFnaW5nIiwidXVpZCI6ImY0OWExNTNiLTY3MTUtNGRhMy1hNzQwLTIyODgxMGQ0MjMyMiIsImlhdCI6MTU5Mjk2MTE3OH0.TSF44TdKUUnZAjfQVsN4bWTwXydTu5YTyedX2iDFGJw',
      });

      quoteQuery = new QuoteQuery({
        attendants: [
          new MinimalAttendant({
            ageRange: AgeRange.Adult,
          }),
          new MinimalAttendant({
            ageRange: AgeRange.Adult,
          }),
        ],
        price: 1030.4,
        currencyCode: 'EUR',
        places: [
          new Place({
            name: 'chicken',
            description: 'A chicken farm',
            partnerInternalId: 'chicken',
            lang: 'fr',
            countryCode: 'FR',
            start: DateTime.local().plus({ days: 10 }),
            end: DateTime.local().plus({ days: 17 }),
          })
        ],
        flights: [
          new MinimalFlight({
            legs: [
              new MinimalLeg({
                departureAirportIATA: 'CDG',
                arrivalAirportIATA: 'JFK',
                departureDate: DateTime.local().plus({ days: 10 }),
              }),
            ],
          }),
        ],
      });
    });

    describe('#quotes', () => {
      it('should return 400 if the quote is ill-formed', async () => {
        await expect(client.quotes(undefined)).rejects.toEqual(
          new APIError({
            status: 400,
            message: `Missing field 'booking'.`,
            source: 'self',
          }),
        );
      });

      it('should return 400 if one of the airport does not exist', async () => {
        const query = quoteQuery;
        query.flights[0].legs[0].departureAirportIATA = 'BEAVERAIRPORT';
        await expect(client.quotes(query)).rejects.toEqual(
          new APIError({
            status: 401,
            message: `Unknown airport: 'BEAVERAIRPORT'.`,
            source: 'self',
          }),
        );
      });

      it('should return 400 if a date is ill-formed', async () => {
        const query = quoteQuery;
        // XXX: Wrong error message due to
        const date = DateTime.local().plus({
          years: 19210910201201200912840981,
        });
        query.flights[0].legs[0].departureDate = date;
        await expect(client.quotes(query)).rejects.toEqual(
          new APIError({
            status: 400,
            message: `Missing field 'local_departure_date'.`,
            source: 'self',
          }),
        );
      });

      it('should return 400 if the quote is in the past', async () => {
        const query = quoteQuery;
        const date = DateTime.local().minus({
          days: 2,
        });
        query.flights[0].legs[0].departureDate = date;
        await expect(client.quotes(query)).rejects.toEqual(
          new APIError({
            status: 400,
            message: `${date.toUTC().toISO()} is in the past.`,
            source: 'self',
          }),
        );
      });

      it('should be possible to quote (valid)', async () => {
        const query = quoteQuery;
        const quotes: Quote[] = await client.quotes(query);
        expect(quotes.length).toBeGreaterThan(0);
        for (const quote of quotes) {
          expect(quote.valid).toBe(true);
        }
      });

      it('should be possible to quote invalid', async () => {
        const query = quoteQuery;
        query.flights[0].legs[0].departureDate = DateTime.local().plus({
          hours: 12,
        });
        const quotes: Quote[] = await client.quotes(query);
        expect(quotes.length).toBeGreaterThan(0);
        for (const quote of quotes) {
          // XXX: Should not be the case.
          expect(quote.valid).toBe(true);
        }
      });
    });

    describe('subscribe', () => {
      it('should be possible to subscribe', async () => {
        const flights = [
          new Flight({
            legs: [
              new Leg({
                departureAirportIATA: 'CDG',
                arrivalAirportIATA: 'JFK',
                departureDate: DateTime.local().plus({ days: 12 }),
                airlineIATA: 'AF',
                flightNumber: '1312',
                arrivalDate: DateTime.local().plus({ days: 16 }).toISO(),
              }),
            ],
          }),
        ];

        const places = [
          new Place({
            name: 'chicken',
            description: 'A chicken farm',
            partnerInternalId: 'chicken',
            lang: 'fr',
            countryCode: 'FR',
            start: DateTime.local().plus({ days: 10 }),
            end: DateTime.local().plus({ days: 17 }),
          }),
        ];

        const quoteQuery = new QuoteQuery({
          attendants: [
            new MinimalAttendant({
              ageRange: AgeRange.Adult,
            }),
            new MinimalAttendant({
              ageRange: AgeRange.Adult,
            }),
          ],
          price: 1030.4,
          currencyCode: 'EUR',
          places,
          flights,
        });

        const quotes: Quote[] = await client.quotes(quoteQuery);
        const quote = quotes[0];

        const subscribe = new SubscribeQuery({
          client: new Client({
            firstName: 'Alain',
            lastName: 'Prost',
            email: 'antony@hikoala.co',
          }),
          booking: new Booking({
            attendants: [
              new Attendant({
                firstName: 'Christine',
                lastName: 'Bravo',
                ageRange: AgeRange.Adult,
              }),
              new Attendant({
                firstName: 'Alain',
                lastName: 'Prost',
                ageRange: AgeRange.Adult,
              }),
            ],
            number: `${Math.floor(DateTime.local().toSeconds())}`,
            price: quoteQuery.price,
            currencyCode: quoteQuery.currencyCode,
            flights,
            places
          }),
          quote,
        });

        const subscription = await client.subscribe(subscribe);
        expect(subscription).toBeDefined();
      });
    });
  });
});
