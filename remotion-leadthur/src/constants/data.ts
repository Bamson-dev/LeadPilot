export interface BusinessResult {
  name: string;
  phone: string;
  email: string;
  website: string;
  rating: number;
}

export const LAGOS_RESTAURANTS: BusinessResult[] = [
  {
    name: "Chicken Republic Lagos Island",
    phone: "0801 234 5678",
    email: "info@chickenrepublic.ng",
    website: "chickenrepublic.ng",
    rating: 4.2,
  },
  {
    name: "Barcelos Victoria Island",
    phone: "0802 345 6789",
    email: "contact@barcelos.ng",
    website: "barcelos.ng",
    rating: 3.8,
  },
  {
    name: "Domino's Pizza Lekki",
    phone: "0803 456 7890",
    email: "lagos@dominosng.com",
    website: "dominos.ng",
    rating: 4.1,
  },
  {
    name: "KFC Ikeja",
    phone: "0804 567 8901",
    email: "ikeja@kfcnigeria.com",
    website: "kfcnigeria.com",
    rating: 3.9,
  },
  {
    name: "Sweet Sensation Surulere",
    phone: "0805 678 9012",
    email: "info@sweetsensation.ng",
    website: "sweetsensation.ng",
    rating: 4.4,
  },
  {
    name: "Mr Biggs Yaba",
    phone: "0806 789 0123",
    email: "yaba@mrbiggs.ng",
    website: "mrbiggs.ng",
    rating: 3.6,
  },
  {
    name: "Mama Cass Maryland",
    phone: "0807 890 1234",
    email: "info@mamacass.ng",
    website: "mamacass.ng",
    rating: 4.0,
  },
  {
    name: "Tantalizers Agege",
    phone: "0808 901 2345",
    email: "agege@tantalizers.ng",
    website: "tantalizers.ng",
    rating: 3.7,
  },
  {
    name: "Tastee Fried Chicken Gbagada",
    phone: "0809 012 3456",
    email: "info@tasteefc.ng",
    website: "tasteefc.ng",
    rating: 4.3,
  },
  {
    name: "Terra Kulture Victoria Island",
    phone: "0810 123 4567",
    email: "reservations@terrakulture.com",
    website: "terrakulture.com",
    rating: 4.6,
  },
  {
    name: "The Place Restaurant Lekki",
    phone: "0811 234 5678",
    email: "info@theplace.ng",
    website: "theplace.ng",
    rating: 4.5,
  },
  {
    name: "Jade Garden Chinese Ikoyi",
    phone: "0812 345 6789",
    email: "bookings@jadegarden.ng",
    website: "jadegarden.ng",
    rating: 4.1,
  },
];

export const FEATURED_BUSINESS = LAGOS_RESTAURANTS[9];
