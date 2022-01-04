from dummy_bank import DummyBank

def dollcoss(bank, btc_price, step_volume):
  bank.buy_btc(step_volume, btc_price)

def value_average(bank, btc_price, target_value, rate):
  purchased_value = bank.balance_btc * btc_price
  if (purchased_value > target_value * rate):
    bank.sell_btc(purchased_value-target_value, btc_price)
  elif (purchased_value > target_value):
    bank.skip_trade(btc_price)
  else:
    bank.buy_btc(target_value-purchased_value, btc_price)

