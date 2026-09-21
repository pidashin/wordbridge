// app/gql/getWords.ts
import { gql } from '@apollo/client';

export const GET_WORDS = gql`
  query GetWords {
    words {
      enUS
      zhTW
      label
      templates
      hasAITemplate
    }
  }
`;

export default GET_WORDS;
