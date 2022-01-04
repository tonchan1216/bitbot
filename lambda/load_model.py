import pandas as pd
import numpy as np
import random
import math
import pickle

from coincheck import market, account, order
import os
from dotenv import load_dotenv

# from tensorflow.keras.models import Sequential
# from tensorflow.keras.layers import Dense, ReLU
# from tensorflow.keras.optimizers import RMSprop
# from sklearn.preprocessing import StandardScaler

class Brain:
    def __init__(self):
        optimizer = RMSprop()

        model = Sequential()
        model.add(Dense(3, input_shape=(3,)))
        model.add(ReLU()) 
        model.add(Dense(3))
        model.add(ReLU())
        model.add(Dense(3))
        model.compile(loss="mse", optimizer=optimizer)
        self.model = model

    def predict(self, state):
        return self.model.predict(state)

    def load(self, name):
        self.model.load_weights(name)

class Agent(Brain):
    def __init__(self):
        super().__init__()
        self.epsilon = 0.01

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
        state = np.empty(3)
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
            if (res['success'] == False):
                print(res['error'])
        # 売り
        elif (action == 2 and self.hold_a_position > 0):
            res = self.ord.sell_btc_jpy(rate=self.now_price, amount=self.hold_a_position)
            print("SELL")
            if (res['success'] == False):
                print(res['error'])
        else:
            print("SKIP")

def main():
    # .envファイルの内容を読み込みます
    load_dotenv()

    name = 'qlearning'
    # agent = Agent()
    wallet = Wallet(os.environ['ACCESS_KEY'], os.environ['SECRET_KEY'])
    # with open('{}.pkl'.format(name), 'rb') as f:
    #     scaler = pickle.load(f)
    # agent.load('{}/{}.h5'.format(mdl_dir, name))
    state = wallet.get_now_state()
    # state = scaler.transform([get_now_state()])
    # action = agent.act(state)
    action = 0
    wallet.trade(action)

main()




