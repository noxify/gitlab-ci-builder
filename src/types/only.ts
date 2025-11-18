type OnlyExpression =
  | {
      refs?: RefList
      variables?: string[]
      changes?: string[]
      kubernetes?: "active"
    }
  | RefList

type ExceptExpression = OnlyExpression

type RefList = Ref[]

type Ref = string | RegExp

export type { OnlyExpression, ExceptExpression }
