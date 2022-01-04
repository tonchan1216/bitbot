class DummyBank:
  # 口座の初期化
  def __init__(self, resource):
    self.resource_yen = resource
    self.balance_yen = resource
    self.total_evaluate_yen = resource
    self.balance_btc = 0
    self.evaluate_history = []
    self.buy_history = []
    self.sell_history = []

  # 指定レートでBTCの購入
  def buy_btc(self, jpy_volume, btc_price):
    self.balance_yen -= jpy_volume # JPY出金
    self.balance_btc += jpy_volume / btc_price # BTC入金
    self.buy_history.append(jpy_volume)
    self.set_evaluate_yen(btc_price)

  # 指定レートでBTCの売却
  def sell_btc(self, jpy_volume, btc_price):
    self.balance_yen += jpy_volume # JPY入金
    self.balance_btc -= jpy_volume / btc_price # BTC出金
    self.sell_history.append(jpy_volume)
    self.set_evaluate_yen(btc_price)

  # Skip
  def skip_trade(self, btc_price):
    self.set_evaluate_yen(btc_price)

  # 再評価
  def set_evaluate_yen(self, btc_price):
    self.total_evaluate_yen = self.balance_yen + self.balance_btc * btc_price
    self.evaluate_history.append(self.total_evaluate_yen)

  # 結果
  def print_performance(self):
    print('## PERFORMANCE ##')
    print('ORIGIN YEN: ', self.resource_yen)
    print('YEN: ', self.balance_yen)
    print('BTC: ', self.balance_btc)
    print('SELL: ', len(self.sell_history))
    print('BUY: ', len(self.buy_history))
    print('EVALUATE: ', self.total_evaluate_yen)
    print('RATE: ', (self.total_evaluate_yen - self.resource_yen) / self.resource_yen * 100)
