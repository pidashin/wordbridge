import { gql } from '@apollo/client';

export const DELETE_WORDS_MUTATION = gql`
  mutation DeleteWords($enUsKeys: [String!]!) {
    deleteWords(enUsKeys: $enUsKeys)
  }
`;

export default DELETE_WORDS_MUTATION;
