import type { AppDispatch, RootState } from "store";
import { createAsyncThunk, AsyncThunkPayloadCreator, AsyncThunk } from "@reduxjs/toolkit";

type AppThunkConfig<RejectValue> = {
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: RejectValue;
  // These are all things we could add to the type, but they're not needed anywhere at present
  // extra?: unknown;
  // serializedErrorType?: unknown;
  // pendingMeta?: unknown;
  // fulfilledMeta?: unknown;
  // rejectedMeta?: unknown;
};

/**
 * This function is just a wrapper on createAsyncThunk that sets up the types for our app
 *
 * @param actionType should be the name of your thunk. So if your thunk function is called
 *                   `asyncDoSomething` then the actionType should be `asyncDoSomething`
 * @param thunkFunc the function that will be called when the thunk is dispatched
 * @returns
 */
const appCreateAsyncThunk = <ArgType, ReturnType = void, RejectValue = unknown>(
  actionType: string,
  // thunkFunc: ThunkFunc<ArgType, ReturnType, RejectValue>
  thunkFunc: AsyncThunkPayloadCreator<ReturnType, ArgType, AppThunkConfig<RejectValue>>
): AsyncThunk<ReturnType, ArgType, AppThunkConfig<RejectValue>> => {
  return createAsyncThunk<ReturnType, ArgType, AppThunkConfig<RejectValue>>(
    "thunk/" + actionType,
    thunkFunc
  );
};

export default appCreateAsyncThunk;
