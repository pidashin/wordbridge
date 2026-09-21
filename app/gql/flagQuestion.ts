import { gql } from '@apollo/client';

export const FLAG_QUESTION = gql`
  mutation FlagQuestion(
    $word: String!
    $questionType: String!
    $questionText: String!
    $reason: String
  ) {
    flagQuestion(
      word: $word
      questionType: $questionType
      questionText: $questionText
      reason: $reason
    ) {
      word
      questionType
      questionText
      reason
      count
      createdAt
      updatedAt
    }
  }
`;

export default FLAG_QUESTION;
