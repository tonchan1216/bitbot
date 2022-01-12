import numpy as np
import copy
import math

class Environment:
    def __init__(self, df, initial_money=100000, mode = 'test', commission = 0, min_trade_btc = 0.005):
        self.df = df.dropna().reset_index()

        self.df_total_steps  = len(self.df)-1
        self.initial_money   = initial_money
        self.mode            = mode
        self.commission      = commission
        self.min_trade_btc   = min_trade_btc
        self.trade_time      = None
        self.trade_win       = None
        self.before_buy_cash = None
        self.action_space    = np.array([0, 1, 2]) # buy,hold,sell
        self.hold_a_position = None
        self.now_price       = None
        self.cash_in_hand    = None
        self.sell_price      = None
        self.buy_price       = None

        self.reset()
        
    def reset(self):
        self.trade_time      = 0
        self.trade_win       = 0
        self.before_buy_cash = 0
        self.end_step        = self.df_total_steps
        self.now_step        = 0
        self.hold_a_position = 0.0
        self.now_price       = self._get_now_price()
        self.cash_in_hand    = self.initial_money
        self.sell_price      = 0
        self.buy_price       = 0

        return self._get_now_state()

    
    def step(self, action):
        self.now_step += 1 # 日付の更新
        self.now_price = self._get_now_price() # レートの更新
 
        done = (self.end_step == self.now_step) # 終了判定

        self.sell_price = 0 
        self._trade(action,done)
        reward = 0

        if (self.sell_price > 0) and (self.buy_price > 0) and ((self.sell_price - self.buy_price) != 0):
            reward = (self.sell_price - self.buy_price) / self.buy_price # 損益率が報酬
            self.buy_price = 0
        cur_revenue = self._get_revenue()
        info = { 'cur_revenue' : cur_revenue , 'trade_time' : self.trade_time, 'trade_win' : self.trade_win }

        return self._get_now_state(), reward, done, info

    # 価格の取得
    def _get_now_price(self):
        return self.df.loc[self.now_step, 'BTC']

    # 状態の取得
    def _get_now_state(self):
        state = np.empty(3)
        state[0] = self.hold_a_position ## 保有するポジション
        state[1] = self.now_price ## 現在のレート
        state[2] = self.cash_in_hand ## 保有する日本円現金
        return state

    #利益の評価
    def _get_revenue(self):
        return self.hold_a_position * self.now_price + self.cash_in_hand

    # 取引実行
    def _trade(self, action,lastorder = False):
        # 最終取引は全て売却
        if lastorder:
            if self.hold_a_position != 0:
                self.cash_in_hand += self.now_price * self.hold_a_position
                self.hold_a_position = 0
                self.trade_time += 1
                if self.cash_in_hand > self.before_buy_cash:
                    self.trade_win += 1
        else:
            # 買い
            if self.action_space[0] == action and self.hold_a_position == 0:
                  self.before_buy_cash = copy.copy(self.cash_in_hand)
                  if self.cash_in_hand < self.now_price * self.min_trade_btc + self.commission * self.now_price:
                    return

                  self.hold_a_position = math.floor(((self.cash_in_hand/self.now_price) - self.commission) * 10000) / 10000 
                  self.buy_price += self.now_price * self.hold_a_position
                  self.cash_in_hand -= self.now_price * self.hold_a_position + self.commission * self.now_price
            # 売り
            if self.action_space[2] == action and self.hold_a_position != 0:
                  self.sell_price += self.now_price * self.hold_a_position
                  self.cash_in_hand += self.now_price * self.hold_a_position - self.commission * self.now_price
                  self.hold_a_position = 0
                  self.trade_time += 1
                  if self.cash_in_hand > self.before_buy_cash:
                      self.trade_win += 1