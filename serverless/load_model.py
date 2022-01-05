import numpy as np
import math
import pickle

from coincheck import market, account, order
import os
from dotenv import load_dotenv
from slack_sdk import WebClient
import tflite_runtime.interpreter as tflite
from sklearn.preprocessing import StandardScaler

class Agent:
    def __init__(self):
        self.epsilon = 0.01

    def load(self, name):
        self.interpreter = tflite.Interpreter(model_path=name)
        self.interpreter.allocate_tensors()

    def predict(self, state):
        input_details = self.interpreter.get_input_details()
        output_details = self.interpreter.get_output_details()
 
        if (input_details[0]['dtype'] == np.float32):
            state = state.astype(np.float32)
 
        self.interpreter.set_tensor(input_details[0]['index'], state)
        self.interpreter.invoke()
        return self.interpreter.get_tensor(output_details[0]['index'])

    def act(self, state):
        if np.random.rand() <= self.epsilon:
            return np.random.choice(3)
        act_values = self.predict(state)
        return np.argmax(act_values[0])

class Wallet():
    def __init__(self, access_key, secret_key):
        self.commission      = 0
        self.min_trade_btc   = 0.005
        self.hold_a_position = None
        self.now_price       = None
        self.cash_in_hand    = None
        self.mkt = market.Market()
        self.act = account.Account(secret_key=secret_key, access_key=access_key)
        self.ord = order.Order(secret_key=secret_key, access_key=access_key)

    def get_now_state(self):
        balance = self.act.get_balance()
        state = np.empty(3, dtype='float32')
        if (self.hold_a_position == None): self.hold_a_position = float(balance['btc'])
        if (self.now_price == None): self.now_price = float(self.mkt.ticker()['bid'])
        if (self.cash_in_hand == None): self.cash_in_hand = float(balance['jpy'])

        state[0] = self.hold_a_position ## 保有するポジション
        state[1] = self.now_price ## 現在のレート
        state[2] = self.cash_in_hand ## 保有する日本円現金
        return state

    def trade(self, action):
        # 買い
        if (action == 0 and self.hold_a_position == 0):
            amount = math.floor(((self.cash_in_hand/self.now_price) - self.commission) * 10000) / 10000 
            res = self.ord.buy_btc_jpy(rate=self.now_price, amount=0.001)
            print("BUY")
            return self._response_handle(res)
        # 売り
        elif (action == 2 and self.hold_a_position > 0):
            res = self.ord.sell_btc_jpy(rate=self.now_price, amount=self.hold_a_position)
            print("SELL")
            return self._response_handle(res)
        else:
            print("SKIP")
            return "SKIP"

    def _response_handle(self, response):
        if (response['success'] == False):
            return response['error']

        return response


def lambda_handler():
    # .envファイルの内容を読み込みます
    load_dotenv()

    name = 'qlearning'
    agent = Agent()
    wallet = Wallet(os.environ['COINCHECK_ACCESS_KEY'], os.environ['COINCHECK_SECRET_KEY'])

    with open('{}.pkl'.format(name), 'rb') as f:
        scaler = pickle.load(f)
    agent.load('{}.tflite'.format(name))

    state = wallet.get_now_state()
    state = scaler.transform([state])
    action = agent.act(state)
    result = wallet.trade(action)

    client = WebClient(token=os.environ["SLACK_API_TOKEN"])
    channel_name=os.environ["CHANNEL_NAME"]
    client.chat_postMessage(text=result, channel=channel_name)

lambda_handler()
